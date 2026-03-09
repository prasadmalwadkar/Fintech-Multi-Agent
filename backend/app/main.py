"""
FastAPI application entrypoint.
Sets up CORS, registers routes, and seeds the database on startup.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, SessionLocal, Base
from app.models import Agent, HandoffRule, Session, Message  # noqa: F401 — ensure models are registered
from app.seed import seed_database
from app.routes import agents, sessions, canvas


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed data on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Fintech Multi-Agent Orchestrator",
    description="Visual AI agent builder with LangGraph orchestration and Gemini API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(agents.router)
app.include_router(sessions.router)
app.include_router(canvas.router)


@app.get("/")
def root():
    return {"message": "Fintech Multi-Agent Orchestrator API", "docs": "/docs"}
