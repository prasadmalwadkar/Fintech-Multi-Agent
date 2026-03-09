"""
Canvas layout API — save/load node positions from React Flow.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Agent
from app.schemas import CanvasPositionsUpdate

router = APIRouter(prefix="/api", tags=["Canvas"])


@router.put("/canvas/positions")
def update_positions(data: CanvasPositionsUpdate, db: DBSession = Depends(get_db)):
    """Batch-update node positions from the React Flow canvas."""
    for pos in data.positions:
        agent = db.query(Agent).filter(Agent.id == pos.id).first()
        if agent:
            agent.position_x = pos.position_x
            agent.position_y = pos.position_y
    db.commit()
    return {"status": "ok", "updated": len(data.positions)}
