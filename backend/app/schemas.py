"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# ── Agent ──────────────────────────────────────────────────────────────────

class AgentBase(BaseModel):
    name: str
    system_instructions: str
    position_x: float = 0.0
    position_y: float = 0.0


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    system_instructions: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None


class AgentResponse(AgentBase):
    id: int

    class Config:
        from_attributes = True


# ── HandoffRule ────────────────────────────────────────────────────────────

class HandoffRuleBase(BaseModel):
    source_agent_id: int
    target_agent_id: int
    trigger_condition: str


class HandoffRuleCreate(HandoffRuleBase):
    pass


class HandoffRuleResponse(HandoffRuleBase):
    id: int

    class Config:
        from_attributes = True


# ── Session ────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    pass


class SessionResponse(BaseModel):
    id: int
    current_active_agent_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Message ────────────────────────────────────────────────────────────────

class MessageBase(BaseModel):
    role: str
    content: str


class MessageResponse(MessageBase):
    id: int
    session_id: int
    timestamp: datetime

    class Config:
        from_attributes = True


# ── Chat ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    active_agent_id: int
    active_agent_name: str
    handoff_occurred: bool = False
    handoff_to: Optional[str] = None


# ── Canvas Positions ──────────────────────────────────────────────────────

class NodePosition(BaseModel):
    id: int
    position_x: float
    position_y: float


class CanvasPositionsUpdate(BaseModel):
    positions: List[NodePosition]
