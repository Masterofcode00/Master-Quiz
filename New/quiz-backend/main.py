"""
main.py
─────────────────────────────────────────────────────────────────
Quiz Competition — FastAPI Backend
─────────────────────────────────────────────────────────────────

Start the server:
    uvicorn main:app --reload --host 127.0.0.1 --port 8000

Interactive docs:
    http://localhost:8000/docs      (Swagger UI)
    http://localhost:8000/redoc     (ReDoc)
─────────────────────────────────────────────────────────────────
"""

import os
from contextlib import asynccontextmanager
from pathlib import Path
import uvicorn
from fastapi import FastAPI

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from dotenv import load_dotenv

load_dotenv()

from database import engine, Base, SessionLocal
from auth import hash_password
import models  # noqa: F401 — registers all ORM models
from routers import auth, questions, results

# ── Path to the frontend folder ────────────────────────────────
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# ── Seed default users ─────────────────────────────────────────
def seed_users():
    """Create default admin / invigilator / teacher users if they don't exist."""
    db = SessionLocal()
    try:
        defaults = [
            {"username": "admin",       "password": "admin@2024",  "role": "admin"},
            {"username": "invigilator", "password": "inv@2024",    "role": "invigilator"},
            {"username": "teacher",     "password": "teach@123",   "role": "invigilator"},
        ]
        for u in defaults:
            existing = db.query(models.User).filter(models.User.username == u["username"]).first()
            if not existing:
                new_user = models.User(
                    username=u["username"],
                    password_hash=hash_password(u["password"]),
                    role=u["role"],
                    is_active=True,
                )
                db.add(new_user)
                print(f"  -> Seeded user: {u['username']} ({u['role']})")
        db.commit()
    finally:
        db.close()


# ── Auto-create tables on startup ───────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create DB tables and seed default users on startup."""
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables verified.")
    seed_users()
    print("[OK] Default users seeded.")
    yield
    print("[OK] Application shutdown.")


# ── App instance ────────────────────────────────────────────────
app = FastAPI(
    title="Quiz Competition API",
    description="""
## Quiz Competition Backend

A complete REST API powering the Quiz Competition web application.

### Features
- 🔐 **JWT Authentication** — secure login for invigilators & admins
- 📝 **Question Bank** — full CRUD for MCQ questions
- 📊 **Results** — participant submission, leaderboard, statistics

### Default Credentials
| Username      | Password     | Role         |
|---------------|-------------|--------------|
| admin         | admin@2024  | admin        |
| invigilator   | inv@2024    | invigilator  |
| teacher       | teach@123   | invigilator  |
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── CORS ────────────────────────────────────────────────────────
_raw_origins = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS = (
    ["*"] if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API Routers ─────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(questions.router)
app.include_router(results.router)


# ── Serve Frontend Static Files ─────────────────────────────────
if FRONTEND_DIR.exists():
    # Mount CSS and JS as static directories
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")


# ── Root — serve index.html ─────────────────────────────────────
@app.get("/", include_in_schema=False)
def serve_index():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"status": "ok", "app": "Quiz Competition API", "docs": "/docs"}


# ── Catch-all for HTML pages ────────────────────────────────────
@app.get("/{page}.html", include_in_schema=False)
def serve_page(page: str):
    file_path = FRONTEND_DIR / f"{page}.html"
    if file_path.exists():
        return FileResponse(str(file_path))
    return JSONResponse(status_code=404, content={"detail": f"Page '{page}.html' not found."})


# ── Health check ────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health():
    """Simple health probe for Docker / load-balancer checks."""
    return {"status": "healthy"}


# ── Global exception handler ────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Returns clean 422 errors instead of the default verbose output."""
    errors = []
    for e in exc.errors():
        field = " → ".join(str(loc) for loc in e["loc"] if loc != "body")
        errors.append({"field": field, "message": e["msg"]})
    return JSONResponse(
        status_code=422,
        content={"detail": "Validation error", "errors": errors},
    )
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)