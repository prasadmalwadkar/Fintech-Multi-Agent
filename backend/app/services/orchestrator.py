"""
LangGraph-based orchestrator for multi-agent routing.
Manages state, calls the active agent, and handles handoffs.
"""

import asyncio
from typing import TypedDict, Optional

from sqlalchemy.orm import Session as DBSession
from fastapi import BackgroundTasks

from app.database import SessionLocal
from app.models import Agent, Session, Message
from app.services.gemini import call_gemini, summarize_message_chunk


# ── State Definition ──────────────────────────────────────────────────────

class AgentState(TypedDict):
    messages: list[dict]          # Full conversation history
    current_agent_id: int         # Active agent ID
    current_agent_name: str       # Active agent name
    session_id: int               # DB session ID
    response_text: Optional[str]  # Final response text
    handoff_occurred: bool        # Whether a handoff happened
    handoff_to: Optional[str]     # Name of agent handed off to


# ── Orchestrator ──────────────────────────────────────────────────────────

async def _background_summarize(session_id: int, message_ids_to_summarize: list[int]):
    """Background task to summarize old messages and update the DB."""
    db = SessionLocal()
    try:
        session = db.query(Session).filter(Session.id == session_id).first()
        if not session:
            return

        # Fetch exact messages to summarize, ordered by ID
        msgs_to_process = (
            db.query(Message)
            .filter(Message.id.in_(message_ids_to_summarize))
            .order_by(Message.id.asc())
            .all()
        )
        if not msgs_to_process:
            return

        new_messages_payload = [{"role": m.role, "content": m.content} for m in msgs_to_process]
        current_summary = session.summary or ""
        
        # Call Gemini summarizer
        new_summary = await summarize_message_chunk(current_summary, new_messages_payload)

        # Update DB
        session.summary = new_summary
        for m in msgs_to_process:
            m.is_summarized = True
        
        db.commit()
    except Exception as e:
        print(f"[Summarizer Task Error] {e}")
    finally:
        db.close()


async def run_agent_turn(db: DBSession, session_id: int, user_message: str, background_tasks: BackgroundTasks) -> dict:
    """
    Execute one full turn of the agent conversation.
    Handles calling the active agent and processing any handoff tool calls.
    Returns the final response dict.
    """
    # Load session
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise ValueError(f"Session {session_id} not found")

    # Save user message
    user_msg = Message(
        session_id=session_id,
        role="user",
        content=user_message,
    )
    db.add(user_msg)
    db.commit()

    # Load full message history
    db_messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp.asc())
        .all()
    )
    
    unsummarized_msgs = [m for m in db_messages if not m.is_summarized]

    if len(unsummarized_msgs) >= 10:
        # Check if we need to chunk! Target the oldest 5 unsummarized messages
        target_msgs = unsummarized_msgs[:5]
        target_ids = [m.id for m in target_msgs]
        
        # Enqueue the background task
        background_tasks.add_task(_background_summarize, session_id, target_ids)

        # Keep only the remaining 5 messages for this turn
        unsummarized_msgs = unsummarized_msgs[5:]

    # Build the exact message array to send to Gemini
    messages = [{"role": m.role, "content": m.content} for m in unsummarized_msgs]
    
    # Prepend the existing summary if there is one
    if session.summary:
        messages.insert(0, {
            "role": "user",
            "content": f"[System: Previous conversation summary: {session.summary}]"
        })

    # Run the agent loop (handles handoffs)
    current_agent = db.query(Agent).filter(Agent.id == session.current_active_agent_id).first()
    handoff_occurred = False
    handoff_to = None
    max_iterations = 5  # Safety limit to prevent infinite loops

    for _ in range(max_iterations):
        # Get ALL other agents as available transfer targets
        # (handoff rules are for canvas visualization; the AI can route to any agent)
        all_agents = db.query(Agent).filter(Agent.id != current_agent.id).all()
        available_targets = [a.name for a in all_agents]

        # Call Gemini
        result = await call_gemini(
            agent_name=current_agent.name,
            system_instructions=current_agent.system_instructions,
            messages=messages,
            available_targets=available_targets,
        )

        if result["tool_call"] and result["tool_call"]["name"] == "transfer_to_agent":
            # Handle the handoff
            target_name = result["tool_call"]["args"].get("target_agent_name", "")
            reason = result["tool_call"]["args"].get("reason", "")

            # Find the target agent
            target_agent = db.query(Agent).filter(Agent.name == target_name).first()
            if not target_agent:
                # If target not found, ask agent to respond normally
                handoff_msg = f"[Transfer to '{target_name}' failed — agent not found. Please respond directly.]"
                messages.append({"role": "user", "content": handoff_msg})
                continue

            # Update session to new agent
            session.current_active_agent_id = target_agent.id
            db.commit()

            # Add system message about the handoff (for DB record)
            handoff_content = f"[Transferred to {target_name}. Reason: {reason}]"
            system_msg = Message(
                session_id=session_id,
                role="system",
                content=handoff_content,
            )
            db.add(system_msg)
            db.commit()

            # For the next Gemini call, add a user-role context message
            # so the new agent knows to answer directly (not re-transfer)
            messages.append({
                "role": "user",
                "content": (
                    f"[System: You are now handling this conversation as {target_name}. "
                    f"The user was just transferred to you. Please answer their most recent question directly.]"
                ),
            })

            current_agent = target_agent
            handoff_occurred = True
            handoff_to = target_name

            # Continue the loop — the new agent will now respond
            continue
        else:
            # We got a text response — we're done
            response_text = result["text"]

            # Save assistant message
            assistant_msg = Message(
                session_id=session_id,
                role="assistant",
                content=response_text,
            )
            db.add(assistant_msg)
            db.commit()

            return {
                "reply": response_text,
                "active_agent_id": current_agent.id,
                "active_agent_name": current_agent.name,
                "handoff_occurred": handoff_occurred,
                "handoff_to": handoff_to,
            }

    # Fallback if max iterations reached
    fallback = "I apologize, but I'm having trouble routing your request. Please try rephrasing."
    fallback_msg = Message(session_id=session_id, role="assistant", content=fallback)
    db.add(fallback_msg)
    db.commit()

    return {
        "reply": fallback,
        "active_agent_id": current_agent.id,
        "active_agent_name": current_agent.name,
        "handoff_occurred": handoff_occurred,
        "handoff_to": handoff_to,
    }

    return {
        "reply": fallback,
        "active_agent_id": current_agent.id,
        "active_agent_name": current_agent.name,
        "handoff_occurred": handoff_occurred,
        "handoff_to": handoff_to,
    }
