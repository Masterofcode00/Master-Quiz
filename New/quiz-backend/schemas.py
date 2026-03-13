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


# ── Results ─────────────────────────────────────────────────────
class ResultCreate(BaseModel):
    name: str = Field(..., min_length=1)
    roll: str = ""
    score: int = Field(..., ge=0)
    total: int = Field(..., ge=1)
    pct: int = Field(0, ge=0, le=100)
    avgTime: Optional[str] = ""


class ResultOut(BaseModel):
    id: int
    name: str
    roll: str
    score: int
    total: int
    pct: int
    timestamp: Optional[str] = None

    class Config:
        from_attributes = True
