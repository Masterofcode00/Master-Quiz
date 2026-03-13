"""
routers/questions.py
CRUD endpoints for quiz questions.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
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
