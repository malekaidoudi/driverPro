from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class StopType(str, Enum):
    delivery = "delivery"
    collection = "collection"
    break_stop = "break"


class StopStatus(str, Enum):
    pending = "pending"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"


class StopBase(BaseModel):
    address: str
    latitude: float
    longitude: float
    notes: Optional[str] = None
    type: StopType = StopType.delivery
    estimated_duration_seconds: int = 180
    package_count: int = 1
    package_finder_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None


class StopCreate(StopBase):
    pass


class StopUpdate(BaseModel):
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    type: Optional[StopType] = None
    status: Optional[StopStatus] = None
    sequence_order: Optional[int] = None
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    estimated_duration_seconds: Optional[int] = None
    package_count: Optional[int] = None
    package_finder_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None


class StopResponse(BaseModel):
    id: str
    route_id: str
    address: str
    latitude: float
    longitude: float
    notes: Optional[str] = None
    type: StopType = StopType.delivery
    estimated_duration_seconds: int = 180
    package_count: int = 1
    package_finder_id: Optional[str] = None
    sequence_order: Optional[int] = None
    status: StopStatus
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class StopBatchCreate(BaseModel):
    stops: list[StopCreate]
