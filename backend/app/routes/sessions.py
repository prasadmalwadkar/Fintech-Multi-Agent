"""
Session and chat API routes.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Agent, Session, Message
from app.schemas import (
    SessionResponse,
    MessageResponse,
    ChatRequest,
    ChatResponse,
)
from app.services.orchestrator import run_agent_turn

router = APIRouter(prefix="/api", tags=["Sessions"])


@router.post("/sessions", response_model=SessionResponse, status_code=201)
def create_session(db: DBSession = Depends(get_db)):
    """Create a new chat session. Defaults to the General Concierge agent."""
    concierge = db.query(Agent).filter(Agent.name == "General Concierge").first()
    if not concierge:
        # Fallback to the first agent
        concierge = db.query(Agent).first()
    if not concierge:
        raise HTTPException(status_code=500, detail="No agents configured")

    session = Session(current_active_agent_id=concierge.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


from fastapi import BackgroundTasks

@router.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat(session_id: int, req: ChatRequest, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    """Send a user message and get the agent's response."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await run_agent_turn(db, session_id, req.message, background_tasks)
    return ChatResponse(**result)


@router.get("/sessions/{session_id}/messages", response_model=List[MessageResponse])
def get_messages(session_id: int, db: DBSession = Depends(get_db)):
    """Get all messages for a session, ordered by timestamp."""
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp.asc())
        .all()
    )
    return messages
