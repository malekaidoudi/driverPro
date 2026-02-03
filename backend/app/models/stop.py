from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, time
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
    rescheduled = "rescheduled"


class OrderPreference(str, Enum):
    first = "first"
    auto = "auto"
    last = "last"


class FailureType(str, Enum):
    absent = "absent"
    rescheduled = "rescheduled"
    no_access = "no_access"


class StopPriority(str, Enum):
    normal = "normal"
    high = "high"
    urgent = "urgent"


class StopBase(BaseModel):
    address: str
    address_complement: Optional[str] = None  # Bât, Villa, Digicode...
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    notes: Optional[str] = None
    type: StopType = StopType.delivery
    priority: StopPriority = StopPriority.normal
    order_preference: OrderPreference = OrderPreference.auto  # first/auto/last
    estimated_duration_seconds: int = 180
    package_count: int = 1
    package_finder_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    time_window_start: Optional[str] = None  # HH:MM format
    time_window_end: Optional[str] = None    # HH:MM format
    package_weight_kg: Optional[float] = None
    package_size: Optional[str] = None       # small, medium, large
    is_fragile: bool = False
    is_favorite: bool = False  # Ajouter aux favoris
    is_recurring: bool = False  # Ajouter aux récurrents


class StopCreate(StopBase):
    pass


class StopUpdate(BaseModel):
    address: Optional[str] = None
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None
    type: Optional[StopType] = None
    priority: Optional[StopPriority] = None
    order_preference: Optional[OrderPreference] = None
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
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    package_weight_kg: Optional[float] = None
    package_size: Optional[str] = None
    is_fragile: Optional[bool] = None


class StopResponse(BaseModel):
    id: str
    route_id: str
    address: str
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    notes: Optional[str] = None
    type: StopType = StopType.delivery
    estimated_duration_seconds: int = 180
    package_count: int = 1
    sequence_order: Optional[int] = None
    status: StopStatus
    arrival_time: Optional[datetime] = None
    departure_time: Optional[datetime] = None
    created_at: datetime
    # Optional fields - may not exist until migration is run
    address_complement: Optional[str] = None
    priority: StopPriority = StopPriority.normal
    order_preference: OrderPreference = OrderPreference.auto
    package_finder_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    time_window_start: Optional[str] = None
    time_window_end: Optional[str] = None
    package_weight_kg: Optional[float] = None
    package_size: Optional[str] = None
    is_fragile: bool = False
    attempt_count: int = 0
    last_failure_type: Optional[FailureType] = None
    favorite_stop_id: Optional[str] = None
    recurring_stop_id: Optional[str] = None
    
    class Config:
        from_attributes = True


class StopBatchCreate(BaseModel):
    stops: list[StopCreate]
