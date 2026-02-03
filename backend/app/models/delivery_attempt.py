from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from .stop import FailureType


class DeliveryAttemptBase(BaseModel):
    """Base model for delivery attempts"""
    attempt_number: int = 1  # 1, 2, or 3
    failure_type: FailureType
    rescheduled_date: Optional[date] = None  # Required if failure_type == rescheduled
    notes: Optional[str] = None


class DeliveryFailureCreate(BaseModel):
    """Model for recording a delivery failure"""
    failure_type: FailureType
    attempt_number: int = 1  # 1ère, 2ème, or 3ème fois
    rescheduled_date: Optional[date] = None  # Si failure_type == rescheduled
    notes: Optional[str] = None


class DeliveryAttemptResponse(BaseModel):
    """Model for delivery attempt response"""
    id: str
    stop_id: str
    attempt_number: int
    failure_type: FailureType
    rescheduled_date: Optional[date] = None
    rescheduled_route_id: Optional[str] = None
    attempted_at: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class DeliveryFailureResult(BaseModel):
    """Model for delivery failure result (returned after recording failure)"""
    success: bool
    message: str
    rescheduled_to: Optional[date] = None
    new_stop_id: Optional[str] = None
    new_route_id: Optional[str] = None
    is_final_failure: bool = False
    attempt_count: int = 0
