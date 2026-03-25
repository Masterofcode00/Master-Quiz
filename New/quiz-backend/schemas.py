"""
schemas.py
Pydantic models for request validation and response serialization.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


# ── Auth ────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


# ── Questions ───────────────────────────────────────────────────
class QuestionCreate(BaseModel):
    question: str = Field(..., min_length=1)
    options: List[str] = Field(..., min_length=4, max_length=4)
    answer: int = Field(..., ge=0, le=3)


class QuestionOut(BaseModel):
    id: int
    question: str
    options: List[str]
    answer: int

    class Config:
        from_attributes = True


class QuestionQuizOut(BaseModel):
    """Secure version for the quiz page — no answer field."""
    id: int
    question: str
    options: List[str]

    class Config:
        from_attributes = True


# ── Results ─────────────────────────────────────────────────────
class AnswerSubmission(BaseModel):
    question_id: int
    selected_index: Optional[int] = None


class ResultCreate(BaseModel):
    name: str = Field(..., min_length=1)
    roll: str = ""
    answers: List[AnswerSubmission]
    avgTime: Optional[str] = ""
    totalTime: Optional[str] = ""


class ResultOut(BaseModel):
    id: int
    name: str
    roll: str
    score: int
    total: int
    pct: int
    totalTime: Optional[str] = ""
    timestamp: Optional[str] = None

    class Config:
        from_attributes = True
