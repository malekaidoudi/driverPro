from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from supabase import Client
from app.core.security import get_current_user, get_authed_supabase_client
from app.models.recurring_stop import (
    RecurringStopCreate,
    RecurringStopUpdate,
    RecurringStopResponse,
    RecurringStopToggle,
)

router = APIRouter(prefix="/recurring-stops", tags=["recurring-stops"])


@router.get("", response_model=List[RecurringStopResponse])
async def get_recurring_stops(
    active_only: bool = False,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Get all recurring stops for the current user"""
    query = supabase.table("recurring_stops").select("*").eq(
        "user_id", current_user["id"]
    )
    
    if active_only:
        query = query.eq("is_active", True)
    
    response = query.order("created_at", desc=True).execute()
    
    return [RecurringStopResponse(**stop) for stop in response.data]


@router.post("", response_model=RecurringStopResponse, status_code=status.HTTP_201_CREATED)
async def create_recurring_stop(
    recurring: RecurringStopCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Create a new recurring stop"""
    recurring_data = recurring.model_dump()
    recurring_data["user_id"] = current_user["id"]
    # Convert enum to string for database
    recurring_data["default_order_preference"] = recurring_data["default_order_preference"].value
    
    response = supabase.table("recurring_stops").insert(recurring_data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create recurring stop")
    
    return RecurringStopResponse(**response.data[0])


@router.get("/{recurring_id}", response_model=RecurringStopResponse)
async def get_recurring_stop(
    recurring_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Get a specific recurring stop"""
    response = supabase.table("recurring_stops").select("*").eq(
        "id", recurring_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Recurring stop not found")
    
    return RecurringStopResponse(**response.data[0])


@router.put("/{recurring_id}", response_model=RecurringStopResponse)
async def update_recurring_stop(
    recurring_id: str,
    recurring_update: RecurringStopUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Update a recurring stop"""
    existing = supabase.table("recurring_stops").select("*").eq(
        "id", recurring_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Recurring stop not found")
    
    update_data = recurring_update.model_dump(exclude_unset=True)
    
    # Convert enum to string if present
    if "default_order_preference" in update_data and update_data["default_order_preference"]:
        update_data["default_order_preference"] = update_data["default_order_preference"].value
    
    response = supabase.table("recurring_stops").update(update_data).eq(
        "id", recurring_id
    ).execute()
    
    return RecurringStopResponse(**response.data[0])


@router.patch("/{recurring_id}/toggle", response_model=RecurringStopResponse)
async def toggle_recurring_stop(
    recurring_id: str,
    toggle: RecurringStopToggle,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Toggle a recurring stop active/inactive"""
    existing = supabase.table("recurring_stops").select("*").eq(
        "id", recurring_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Recurring stop not found")
    
    response = supabase.table("recurring_stops").update({
        "is_active": toggle.is_active
    }).eq("id", recurring_id).execute()
    
    return RecurringStopResponse(**response.data[0])


@router.delete("/{recurring_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_stop(
    recurring_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Delete a recurring stop"""
    existing = supabase.table("recurring_stops").select("*").eq(
        "id", recurring_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Recurring stop not found")
    
    supabase.table("recurring_stops").delete().eq("id", recurring_id).execute()
    
    return None


@router.get("/for-day/{day_of_week}", response_model=List[RecurringStopResponse])
async def get_recurring_stops_for_day(
    day_of_week: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """
    Get all active recurring stops for a specific day of week.
    day_of_week: 1=Monday, 7=Sunday
    """
    if day_of_week < 1 or day_of_week > 7:
        raise HTTPException(status_code=400, detail="day_of_week must be between 1 and 7")
    
    response = supabase.table("recurring_stops").select("*").eq(
        "user_id", current_user["id"]
    ).eq("is_active", True).contains("days_of_week", [day_of_week]).execute()
    
    return [RecurringStopResponse(**stop) for stop in response.data]
