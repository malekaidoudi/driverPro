from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date
from supabase import Client
from app.core.security import get_current_user, get_authed_supabase_client
from app.models.route import (
    RouteCreate, RouteUpdate, RouteResponse, RouteWithStops, RouteGroupedByDate
)
from app.models.stop import StopResponse

router = APIRouter(prefix="/routes", tags=["routes"])


@router.get("", response_model=List[RouteGroupedByDate])
async def get_routes(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    response = supabase.table("routes").select("*").eq("user_id", current_user["id"]).order("route_date", desc=True).execute()
    
    routes_by_date = {}
    for route in response.data:
        route_date = route["route_date"]
        if route_date not in routes_by_date:
            routes_by_date[route_date] = []
        routes_by_date[route_date].append(RouteResponse(**route))
    
    grouped_routes = [
        RouteGroupedByDate(date=date_key, routes=routes)
        for date_key, routes in routes_by_date.items()
    ]
    
    return grouped_routes


@router.post("", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(
    route: RouteCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    route_data = route.model_dump()
    route_data["user_id"] = current_user["id"]
    route_data["route_date"] = str(route_data["route_date"])
    
    response = supabase.table("routes").insert(route_data).execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create route")
    
    return RouteResponse(**response.data[0])


@router.get("/{route_id}", response_model=RouteWithStops)
async def get_route(
    route_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    route_response = supabase.table("routes").select("*").eq("id", route_id).eq("user_id", current_user["id"]).execute()
    
    if not route_response.data:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route = route_response.data[0]
    
    stops_response = supabase.table("stops").select("*").eq("route_id", route_id).order("sequence_order", desc=False, nullsfirst=False).execute()
    
    stops = [StopResponse(**stop) for stop in stops_response.data]
    
    return RouteWithStops(**route, stops=stops)


@router.put("/{route_id}", response_model=RouteResponse)
async def update_route(
    route_id: str,
    route_update: RouteUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    route_response = supabase.table("routes").select("*").eq("id", route_id).eq("user_id", current_user["id"]).execute()
    
    if not route_response.data:
        raise HTTPException(status_code=404, detail="Route not found")
    
    update_data = route_update.model_dump(exclude_unset=True)
    if "route_date" in update_data:
        update_data["route_date"] = str(update_data["route_date"])
    
    response = supabase.table("routes").update(update_data).eq("id", route_id).execute()
    
    return RouteResponse(**response.data[0])


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(
    route_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    route_response = supabase.table("routes").select("*").eq("id", route_id).eq("user_id", current_user["id"]).execute()
    
    if not route_response.data:
        raise HTTPException(status_code=404, detail="Route not found")
    
    supabase.table("routes").delete().eq("id", route_id).execute()
    
    return None
