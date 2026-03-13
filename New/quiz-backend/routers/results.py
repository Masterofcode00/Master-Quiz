"""
routers/results.py
Quiz result submission and leaderboard endpoints.
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models import Result, User
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
        timestamp=r.timestamp.isoformat() if r.timestamp else None,
    )


@router.get("", response_model=List[ResultOut])
def list_results(db: Session = Depends(get_db)):
    """Return all results sorted by score descending (public)."""
    rows = db.query(Result).order_by(Result.pct.desc()).all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=ResultOut, status_code=status.HTTP_201_CREATED)
def submit_result(payload: ResultCreate, db: Session = Depends(get_db)):
    """Submit a quiz result (public — called from quiz page after completion)."""
    r = Result(
        name=payload.name,
        roll=payload.roll,
        score=payload.score,
        total=payload.total,
        pct=payload.pct,
        avg_time=payload.avgTime or "",
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
