"""
models.py
SQLAlchemy ORM models: User, Question, Result.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from database import Base


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), nullable=False, default="invigilator")  # admin | invigilator
    is_active     = Column(Boolean, default=True)


class Question(Base):
    __tablename__ = "questions"

    id         = Column(Integer, primary_key=True, index=True)
    question   = Column(Text, nullable=False)
    option_a   = Column(String(500), nullable=False)
    option_b   = Column(String(500), nullable=False)
    option_c   = Column(String(500), nullable=False)
    option_d   = Column(String(500), nullable=False)
    answer     = Column(Integer, nullable=False)  # 0=A, 1=B, 2=C, 3=D
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Result(Base):
    __tablename__ = "results"

    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String(100), nullable=False)
    roll      = Column(String(50), nullable=True, default="")
    score     = Column(Integer, nullable=False)
    total     = Column(Integer, nullable=False)
    pct       = Column(Integer, nullable=False, default=0)
    avg_time  = Column(String(10), nullable=True, default="")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
