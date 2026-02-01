from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum
from app.models.stop import StopResponse


class RouteStatus(str, Enum):
    draft = "draft"
    optimized = "optimized"
    in_progress = "in_progress"
    completed = "completed"


class RouteBase(BaseModel):
    name: str
    route_date: date


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    name: Optional[str] = None
    route_date: Optional[date] = None
    status: Optional[RouteStatus] = None
    total_distance_meters: Optional[int] = None
    total_duration_seconds: Optional[int] = None


class RouteResponse(RouteBase):
    id: str
    user_id: str
    status: RouteStatus
    total_distance_meters: Optional[int] = None
    total_duration_seconds: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class RouteWithStops(RouteResponse):
    stops: List[StopResponse] = Field(default_factory=list)


class RouteGroupedByDate(BaseModel):
    date: date
    routes: List[RouteResponse]
