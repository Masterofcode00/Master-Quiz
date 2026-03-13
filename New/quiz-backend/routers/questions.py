"""
routers/questions.py
CRUD endpoints for quiz questions.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import Question, User
from schemas import QuestionCreate, QuestionOut
from auth import get_current_user

router = APIRouter(prefix="/api/questions", tags=["questions"])


def _to_out(q: Question) -> QuestionOut:
    """Convert a Question ORM object to the frontend-friendly schema."""
    return QuestionOut(
        id=q.id,
        question=q.question,
        options=[q.option_a, q.option_b, q.option_c, q.option_d],
        answer=q.answer,
    )


@router.get("", response_model=List[QuestionOut])
def list_questions(db: Session = Depends(get_db)):
    """Return all questions (public — used by quiz page)."""
    rows = db.query(Question).order_by(Question.id).all()
    return [_to_out(q) for q in rows]


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
def add_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new question (auth required)."""
    q = Question(
        question=payload.question,
        option_a=payload.options[0],
        option_b=payload.options[1],
        option_c=payload.options[2],
        option_d=payload.options[3],
        answer=payload.answer,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return _to_out(q)


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a question by ID (auth required)."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    db.delete(q)
    db.commit()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_questions(
    file: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk upload questions from an Excel (.xlsx) or CSV file (auth required)."""
    import pandas as pd
    from io import BytesIO

    if not file.filename.endswith((".xlsx", ".csv")):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Please upload an Excel (.xlsx) or CSV file.",
        )

    try:
        content = await file.read()
        if file.filename.endswith(".xlsx"):
            df = pd.read_excel(BytesIO(content))
        else:
            df = pd.read_csv(BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    # Standardize column names (lowercase, strip whitespace)
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Map expected columns to standardized ones
    col_mapping = {
        "question": ["question", "q"],
        "option_a": ["option a", "option_a", "optiona", "op1", "opt1", "a"],
        "option_b": ["option b", "option_b", "optionb", "op2", "opt2", "b"],
        "option_c": ["option c", "option_c", "optionc", "op3", "opt3", "c"],
        "option_d": ["option d", "option_d", "optiond", "op4", "opt4", "d"],
        "answer": ["answer", "correct answer", "correct_answer", "ans"],
    }

    # Find the actual matching column names in the uploaded file
    file_cols = {}
    for expected_key, possible_names in col_mapping.items():
        found = False
        for col in df.columns:
            if col in possible_names:
                file_cols[expected_key] = col
                found = True
                break
        if not found:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required column for '{expected_key}'. "
                f"Expected one of: {', '.join(possible_names)}",
            )

    # Required valid answer mapping (A->0, B->1, C->2, D->3)
    ans_map = {"a": 0, "b": 1, "c": 2, "d": 3}
    for i, v in enumerate(["0", "1", "2", "3"]):
        ans_map[v] = int(v)

    added_count = 0
    for index, row in df.iterrows():
        question_text = str(row[file_cols["question"]]).strip()
        op_a = str(row[file_cols["option_a"]]).strip()
        op_b = str(row[file_cols["option_b"]]).strip()
        op_c = str(row[file_cols["option_c"]]).strip()
        op_d = str(row[file_cols["option_d"]]).strip()
        raw_ans = str(row[file_cols["answer"]]).strip().lower()

        if not all([question_text, op_a, op_b, op_c, op_d, raw_ans]):
            continue  # Skip rows with missing data

        # Parse the given answer
        answer_idx = ans_map.get(raw_ans)
        if answer_idx is None:
            # Maybe the user typed the full option text as the answer instead of A/B/C/D
            match_text = raw_ans.lower()
            if match_text == op_a.lower():
                answer_idx = 0
            elif match_text == op_b.lower():
                answer_idx = 1
            elif match_text == op_c.lower():
                answer_idx = 2
            elif match_text == op_d.lower():
                answer_idx = 3
            else:
                continue # Skip row if correct answer cannot be determined.

        q = Question(
            question=question_text,
            option_a=op_a,
            option_b=op_b,
            option_c=op_c,
            option_d=op_d,
            answer=answer_idx,
        )
        db.add(q)
        added_count += 1

    db.commit()
    return {"message": f"Successfully imported {added_count} questions."}
