from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FavoriteStopBase(BaseModel):
    """Base model for favorite stops"""
    address: str
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    label: Optional[str] = None  # Nom personnalisé (ex: "M. Dupont - Lundi")


class FavoriteStopCreate(FavoriteStopBase):
    """Model for creating a favorite stop"""
    pass


class FavoriteStopUpdate(BaseModel):
    """Model for updating a favorite stop"""
    address: Optional[str] = None
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    label: Optional[str] = None


class FavoriteStopResponse(FavoriteStopBase):
    """Model for favorite stop response"""
    id: str
    user_id: str
    usage_count: int = 0
    last_used_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FavoriteStopAddToRoute(BaseModel):
    """Model for adding a favorite stop to a route"""
    route_id: str
    package_count: int = 1
    order_preference: str = "auto"  # first, auto, last
    notes: Optional[str] = None
