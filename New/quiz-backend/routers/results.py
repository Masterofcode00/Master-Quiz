"""
routers/results.py
Quiz result submission and leaderboard endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models import Result, User, Question
from schemas import ResultCreate, ResultOut
from auth import get_current_user

router = APIRouter(prefix="/api/results", tags=["results"])


def _to_out(r: Result) -> ResultOut:
    """Convert a Result ORM object to the response schema."""
    return ResultOut(
        id=r.id,
        name=r.name,
        roll=r.roll or "",
        score=r.score,
        total=r.total,
        pct=r.pct,
        avgTime=r.avg_time or "",
        totalTime=r.total_time or "",
        timestamp=r.timestamp.isoformat() if r.timestamp else None,
    )


@router.get("", response_model=List[ResultOut])
def list_results(db: Session = Depends(get_db)):
    """Return all results sorted by score descending (public)."""
    rows = db.query(Result).order_by(Result.pct.desc()).all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=ResultOut, status_code=status.HTTP_201_CREATED)
def submit_result(payload: ResultCreate, db: Session = Depends(get_db)):
    """Submit a quiz result (secure — calculates score on the server)."""
    # 1. Calculate Score
    score = 0
    total = len(payload.answers)
    
    if total > 0:
        # Fetch correct answers for all submitted question IDs
        q_ids = [a.question_id for a in payload.answers]
        questions = db.query(Question).filter(Question.id.in_(q_ids)).all()
        correct_map = {q.id: q.answer for q in questions}

        for ans in payload.answers:
            if ans.selected_index == correct_map.get(ans.question_id):
                score += 1
    
    pct = int(round((score / total) * 100)) if total > 0 else 0

    # 2. Save Result
    r = Result(
        name=payload.name,
        roll=payload.roll,
        score=score,
        total=total,
        pct=pct,
        avg_time=payload.avgTime or "",
        total_time=payload.totalTime or "",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _to_out(r)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_results(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Clear all results (auth required)."""
    db.query(Result).delete()
    db.commit()
