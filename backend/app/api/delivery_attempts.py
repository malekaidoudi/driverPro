from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date, timedelta
from supabase import Client
from app.core.security import get_current_user, get_authed_supabase_client
from app.models.delivery_attempt import (
    DeliveryFailureCreate,
    DeliveryAttemptResponse,
    DeliveryFailureResult,
)
from app.models.stop import FailureType

router = APIRouter(tags=["delivery-attempts"])


async def verify_stop_ownership(
    stop_id: str,
    current_user: dict,
    supabase: Client
):
    """Verify that the stop belongs to a route owned by the current user"""
    stop_response = supabase.table("stops").select("*, routes!inner(user_id)").eq(
        "id", stop_id
    ).execute()
    
    if not stop_response.data:
        raise HTTPException(status_code=404, detail="Stop not found")
    
    if stop_response.data[0]["routes"]["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this stop")
    
    return stop_response.data[0]


@router.post("/stops/{stop_id}/fail", response_model=DeliveryFailureResult)
async def record_delivery_failure(
    stop_id: str,
    failure: DeliveryFailureCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """
    Record a delivery failure and handle auto-rescheduling.
    
    - absent: Reschedules to next day (up to 3 attempts)
    - rescheduled: Reschedules to specified date
    - no_access: Marks as final failure
    """
    stop = await verify_stop_ownership(stop_id, current_user, supabase)
    
    # Record the delivery attempt
    attempt_data = {
        "stop_id": stop_id,
        "attempt_number": failure.attempt_number,
        "failure_type": failure.failure_type.value,
        "rescheduled_date": str(failure.rescheduled_date) if failure.rescheduled_date else None,
        "notes": failure.notes,
    }
    
    supabase.table("delivery_attempts").insert(attempt_data).execute()
    
    # Update stop status
    update_data = {
        "status": "failed",
        "attempt_count": failure.attempt_number,
        "last_failure_type": failure.failure_type.value,
    }
    
    supabase.table("stops").update(update_data).eq("id", stop_id).execute()
    
    result = DeliveryFailureResult(
        success=True,
        message="Échec enregistré",
        attempt_count=failure.attempt_number,
    )
    
    # Handle rescheduling based on failure type
    if failure.failure_type == FailureType.absent:
        if failure.attempt_number >= 3:
            # 3rd attempt = final failure
            result.is_final_failure = True
            result.message = "3ème tentative échouée - Échec définitif"
        else:
            # Reschedule to tomorrow
            tomorrow = date.today() + timedelta(days=1)
            new_stop = await _reschedule_stop(
                stop, tomorrow, current_user, supabase, stop_id
            )
            result.rescheduled_to = tomorrow
            result.new_stop_id = new_stop["id"]
            result.new_route_id = new_stop["route_id"]
            result.message = f"Reprogrammé pour le {tomorrow.strftime('%d/%m/%Y')}"
    
    elif failure.failure_type == FailureType.rescheduled:
        if not failure.rescheduled_date:
            raise HTTPException(
                status_code=400, 
                detail="rescheduled_date is required for 'rescheduled' failure type"
            )
        
        new_stop = await _reschedule_stop(
            stop, failure.rescheduled_date, current_user, supabase, stop_id
        )
        result.rescheduled_to = failure.rescheduled_date
        result.new_stop_id = new_stop["id"]
        result.new_route_id = new_stop["route_id"]
        result.message = f"Reporté au {failure.rescheduled_date.strftime('%d/%m/%Y')}"
        
        # Update original stop status to rescheduled
        supabase.table("stops").update({"status": "rescheduled"}).eq("id", stop_id).execute()
    
    elif failure.failure_type == FailureType.no_access:
        result.is_final_failure = True
        result.message = "Pas d'accès - Échec définitif"
    
    return result


async def _reschedule_stop(
    original_stop: dict,
    target_date: date,
    current_user: dict,
    supabase: Client,
    original_stop_id: str
) -> dict:
    """
    Reschedule a stop to a target date.
    Creates or finds a route for that date and adds a copy of the stop.
    """
    # Find or create route for target date
    route_response = supabase.table("routes").select("*").eq(
        "user_id", current_user["id"]
    ).eq("route_date", str(target_date)).execute()
    
    if route_response.data:
        target_route = route_response.data[0]
    else:
        # Create new route for target date
        new_route_data = {
            "user_id": current_user["id"],
            "name": f"Tournée {target_date.strftime('%d/%m/%Y')}",
            "route_date": str(target_date),
            "status": "draft",
        }
        new_route_response = supabase.table("routes").insert(new_route_data).execute()
        target_route = new_route_response.data[0]
    
    # Create copy of stop in target route
    new_stop_data = {
        "route_id": target_route["id"],
        "address": original_stop["address"],
        "address_complement": original_stop.get("address_complement"),
        "postal_code": original_stop.get("postal_code"),
        "city": original_stop.get("city"),
        "latitude": original_stop["latitude"],
        "longitude": original_stop["longitude"],
        "first_name": original_stop.get("first_name"),
        "last_name": original_stop.get("last_name"),
        "phone_number": original_stop.get("phone_number"),
        "notes": original_stop.get("notes"),
        "package_count": original_stop.get("package_count", 1),
        "order_preference": original_stop.get("order_preference", "auto"),
        "priority": original_stop.get("priority", "normal"),
        "attempt_count": original_stop.get("attempt_count", 0),
        "rescheduled_from_stop_id": original_stop_id,
        "favorite_stop_id": original_stop.get("favorite_stop_id"),
        "recurring_stop_id": original_stop.get("recurring_stop_id"),
        "status": "pending",
    }
    
    new_stop_response = supabase.table("stops").insert(new_stop_data).execute()
    
    return new_stop_response.data[0]


@router.get("/stops/{stop_id}/attempts", response_model=List[DeliveryAttemptResponse])
async def get_delivery_attempts(
    stop_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Get all delivery attempts for a stop"""
    await verify_stop_ownership(stop_id, current_user, supabase)
    
    response = supabase.table("delivery_attempts").select("*").eq(
        "stop_id", stop_id
    ).order("attempted_at", desc=True).execute()
    
    return [DeliveryAttemptResponse(**attempt) for attempt in response.data]
