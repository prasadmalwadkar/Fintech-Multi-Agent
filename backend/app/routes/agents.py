"""
Agent and HandoffRule CRUD API routes.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Agent, HandoffRule
from app.schemas import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    HandoffRuleCreate,
    HandoffRuleResponse,
)

router = APIRouter(prefix="/api", tags=["Agents"])


# ── Agent Endpoints ───────────────────────────────────────────────────────

@router.get("/agents", response_model=List[AgentResponse])
def list_agents(db: DBSession = Depends(get_db)):
    return db.query(Agent).all()


@router.post("/agents", response_model=AgentResponse, status_code=201)
def create_agent(agent: AgentCreate, db: DBSession = Depends(get_db)):
    db_agent = Agent(**agent.model_dump())
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent


@router.put("/agents/{agent_id}", response_model=AgentResponse)
def update_agent(agent_id: int, agent: AgentUpdate, db: DBSession = Depends(get_db)):
    db_agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    update_data = agent.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_agent, key, value)
    db.commit()
    db.refresh(db_agent)
    return db_agent


@router.delete("/agents/{agent_id}", status_code=204)
def delete_agent(agent_id: int, db: DBSession = Depends(get_db)):
    db_agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not db_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    db.delete(db_agent)
    db.commit()


# ── Handoff Rule Endpoints ────────────────────────────────────────────────

@router.get("/handoff-rules", response_model=List[HandoffRuleResponse])
def list_handoff_rules(db: DBSession = Depends(get_db)):
    return db.query(HandoffRule).all()


@router.post("/handoff-rules", response_model=HandoffRuleResponse, status_code=201)
def create_handoff_rule(rule: HandoffRuleCreate, db: DBSession = Depends(get_db)):
    # Validate both agents exist
    source = db.query(Agent).filter(Agent.id == rule.source_agent_id).first()
    target = db.query(Agent).filter(Agent.id == rule.target_agent_id).first()
    if not source or not target:
        raise HTTPException(status_code=400, detail="Source or target agent not found")
    db_rule = HandoffRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.delete("/handoff-rules/{rule_id}", status_code=204)
def delete_handoff_rule(rule_id: int, db: DBSession = Depends(get_db)):
    db_rule = db.query(HandoffRule).filter(HandoffRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Handoff rule not found")
    db.delete(db_rule)
    db.commit()
