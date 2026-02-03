from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from supabase import Client
from datetime import datetime
from app.core.security import get_current_user, get_authed_supabase_client
from app.models.favorite_stop import (
    FavoriteStopCreate,
    FavoriteStopUpdate,
    FavoriteStopResponse,
    FavoriteStopAddToRoute,
)
from app.models.stop import StopResponse

router = APIRouter(prefix="/favorite-stops", tags=["favorite-stops"])


@router.get("", response_model=List[FavoriteStopResponse])
async def get_favorite_stops(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Get all favorite stops for the current user"""
    response = supabase.table("favorite_stops").select("*").eq(
        "user_id", current_user["id"]
    ).order("usage_count", desc=True).execute()
    
    return [FavoriteStopResponse(**stop) for stop in response.data]


@router.post("", response_model=FavoriteStopResponse, status_code=status.HTTP_201_CREATED)
async def create_favorite_stop(
    favorite: FavoriteStopCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Create a new favorite stop"""
    favorite_data = favorite.model_dump()
    favorite_data["user_id"] = current_user["id"]
    
    response = supabase.table("favorite_stops").insert(favorite_data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create favorite stop")
    
    return FavoriteStopResponse(**response.data[0])


@router.get("/{favorite_id}", response_model=FavoriteStopResponse)
async def get_favorite_stop(
    favorite_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Get a specific favorite stop"""
    response = supabase.table("favorite_stops").select("*").eq(
        "id", favorite_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not response.data:
        raise HTTPException(status_code=404, detail="Favorite stop not found")
    
    return FavoriteStopResponse(**response.data[0])


@router.put("/{favorite_id}", response_model=FavoriteStopResponse)
async def update_favorite_stop(
    favorite_id: str,
    favorite_update: FavoriteStopUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Update a favorite stop"""
    existing = supabase.table("favorite_stops").select("*").eq(
        "id", favorite_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Favorite stop not found")
    
    update_data = favorite_update.model_dump(exclude_unset=True)
    
    response = supabase.table("favorite_stops").update(update_data).eq(
        "id", favorite_id
    ).execute()
    
    return FavoriteStopResponse(**response.data[0])


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_favorite_stop(
    favorite_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Delete a favorite stop"""
    existing = supabase.table("favorite_stops").select("*").eq(
        "id", favorite_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not existing.data:
        raise HTTPException(status_code=404, detail="Favorite stop not found")
    
    supabase.table("favorite_stops").delete().eq("id", favorite_id).execute()
    
    return None


@router.post("/{favorite_id}/add-to-route", response_model=StopResponse)
async def add_favorite_to_route(
    favorite_id: str,
    data: FavoriteStopAddToRoute,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    """Add a favorite stop to a route"""
    # Verify favorite exists
    fav_response = supabase.table("favorite_stops").select("*").eq(
        "id", favorite_id
    ).eq("user_id", current_user["id"]).execute()
    
    if not fav_response.data:
        raise HTTPException(status_code=404, detail="Favorite stop not found")
    
    favorite = fav_response.data[0]
    
    # Verify route ownership
    route_response = supabase.table("routes").select("user_id").eq(
        "id", data.route_id
    ).execute()
    
    if not route_response.data:
        raise HTTPException(status_code=404, detail="Route not found")
    
    if route_response.data[0]["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to access this route")
    
    # Create stop from favorite
    stop_data = {
        "route_id": data.route_id,
        "address": favorite["address"],
        "address_complement": favorite.get("address_complement"),
        "postal_code": favorite.get("postal_code"),
        "city": favorite.get("city"),
        "latitude": favorite["latitude"],
        "longitude": favorite["longitude"],
        "first_name": favorite.get("first_name"),
        "last_name": favorite.get("last_name"),
        "phone_number": favorite.get("phone_number"),
        "package_count": data.package_count,
        "order_preference": data.order_preference,
        "notes": data.notes,
        "favorite_stop_id": favorite_id,
    }
    
    stop_response = supabase.table("stops").insert(stop_data).execute()
    
    if not stop_response.data:
        raise HTTPException(status_code=400, detail="Failed to create stop from favorite")
    
    # Update favorite usage stats
    supabase.table("favorite_stops").update({
        "usage_count": favorite.get("usage_count", 0) + 1,
        "last_used_at": datetime.utcnow().isoformat()
    }).eq("id", favorite_id).execute()
    
    return StopResponse(**stop_response.data[0])
