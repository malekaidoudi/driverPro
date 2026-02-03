from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from supabase import Client
from app.core.security import get_current_user, get_authed_supabase_client
from app.models.stop import StopCreate, StopUpdate, StopResponse, StopBatchCreate

router = APIRouter(prefix="/routes/{route_id}/stops", tags=["stops"])


async def verify_route_ownership(
    route_id: str,
    current_user: dict,
    supabase: Client
):
    route_response = supabase.table("routes").select("user_id").eq("id", route_id).execute()
    
    if not route_response.data:
        raise HTTPException(status_code=404, detail="Route not found")
    
    if route_response.data[0]["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this route")
    
    return True


@router.post("", response_model=StopResponse, status_code=status.HTTP_201_CREATED)
async def create_stop(
    route_id: str,
    stop: StopCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    await verify_route_ownership(route_id, current_user, supabase)
    
    # Exclude fields not in database schema
    stop_data = stop.model_dump(exclude={
        "first_name", "last_name", "phone_number",
        "is_favorite", "is_recurring"  # These are flags, not DB columns
    })
    stop_data["route_id"] = route_id
    
    response = supabase.table("stops").insert(stop_data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create stop")
    
    return StopResponse(**response.data[0])


@router.post("/batch", response_model=List[StopResponse], status_code=status.HTTP_201_CREATED)
async def create_stops_batch(
    route_id: str,
    batch: StopBatchCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    await verify_route_ownership(route_id, current_user, supabase)
    
    stops_data = []
    for stop in batch.stops:
        stop_data = stop.model_dump(exclude={
            "first_name", "last_name", "phone_number",
            "is_favorite", "is_recurring"
        })
        stop_data["route_id"] = route_id
        stops_data.append(stop_data)
    
    response = supabase.table("stops").insert(stops_data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create stops")
    
    return [StopResponse(**stop) for stop in response.data]


@router.put("/{stop_id}", response_model=StopResponse)
async def update_stop(
    route_id: str,
    stop_id: str,
    stop_update: StopUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    await verify_route_ownership(route_id, current_user, supabase)
    
    stop_response = supabase.table("stops").select("*").eq("id", stop_id).eq("route_id", route_id).execute()
    
    if not stop_response.data:
        raise HTTPException(status_code=404, detail="Stop not found")
    
    update_data = stop_update.model_dump(exclude_unset=True)
    
    response = supabase.table("stops").update(update_data).eq("id", stop_id).execute()
    
    return StopResponse(**response.data[0])


@router.delete("/{stop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stop(
    route_id: str,
    stop_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    await verify_route_ownership(route_id, current_user, supabase)
    
    stop_response = supabase.table("stops").select("*").eq("id", stop_id).eq("route_id", route_id).execute()
    
    if not stop_response.data:
        raise HTTPException(status_code=404, detail="Stop not found")
    
    supabase.table("stops").delete().eq("id", stop_id).execute()
    
    return None
