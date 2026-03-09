"""
SQLAlchemy ORM models for the Fintech Multi-Agent system.
"""

import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    system_instructions = Column(Text, nullable=False)
    position_x = Column(Float, default=0.0)
    position_y = Column(Float, default=0.0)

    # Relationships
    outgoing_handoffs = relationship(
        "HandoffRule",
        foreign_keys="HandoffRule.source_agent_id",
        back_populates="source_agent",
        cascade="all, delete-orphan",
    )
    incoming_handoffs = relationship(
        "HandoffRule",
        foreign_keys="HandoffRule.target_agent_id",
        back_populates="target_agent",
        cascade="all, delete-orphan",
    )


class HandoffRule(Base):
    __tablename__ = "handoff_rules"

    id = Column(Integer, primary_key=True, index=True)
    source_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    target_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    trigger_condition = Column(Text, nullable=False)

    # Relationships
    source_agent = relationship(
        "Agent", foreign_keys=[source_agent_id], back_populates="outgoing_handoffs"
    )
    target_agent = relationship(
        "Agent", foreign_keys=[target_agent_id], back_populates="incoming_handoffs"
    )


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    current_active_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    summary = Column(Text, default="", nullable=True)

    # Relationships
    active_agent = relationship("Agent")
    messages = relationship(
        "Message", back_populates="session", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user", "assistant", "system"
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    is_summarized = Column(Boolean, default=False)

    # Relationships
    session = relationship("Session", back_populates="messages")
