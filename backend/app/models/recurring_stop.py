from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from .stop import OrderPreference


class RecurringStopBase(BaseModel):
    """Base model for recurring stops (daily/weekly auto-added stops)"""
    address: str
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: bool = True
    days_of_week: List[int] = Field(default=[1, 2, 3, 4, 5])  # 1=Lun, 7=Dim
    default_package_count: int = 1
    default_order_preference: OrderPreference = OrderPreference.auto
    notes: Optional[str] = None


class RecurringStopCreate(RecurringStopBase):
    """Model for creating a recurring stop"""
    pass


class RecurringStopUpdate(BaseModel):
    """Model for updating a recurring stop"""
    address: Optional[str] = None
    address_complement: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    is_active: Optional[bool] = None
    days_of_week: Optional[List[int]] = None
    default_package_count: Optional[int] = None
    default_order_preference: Optional[OrderPreference] = None
    notes: Optional[str] = None


class RecurringStopResponse(RecurringStopBase):
    """Model for recurring stop response"""
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecurringStopToggle(BaseModel):
    """Model for toggling recurring stop active status"""
    is_active: bool
