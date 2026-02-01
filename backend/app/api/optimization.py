from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from app.core.security import get_current_user, get_authed_supabase_client
from app.models.route import RouteWithStops
from app.models.stop import StopResponse
from app.services.or_tools_service import optimize_route
from datetime import datetime, timedelta

router = APIRouter(prefix="/routes/{route_id}/optimize", tags=["optimization"])


@router.post("", response_model=RouteWithStops)
async def optimize_route_endpoint(
    route_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase_client)
):
    route_response = supabase.table("routes").select("*").eq("id", route_id).eq("user_id", current_user["id"]).execute()
    
    if not route_response.data:
        raise HTTPException(status_code=404, detail="Route not found")
    
    route = route_response.data[0]
    
    stops_response = supabase.table("stops").select("*").eq("route_id", route_id).execute()
    
    if not stops_response.data or len(stops_response.data) < 2:
        raise HTTPException(status_code=400, detail="Route must have at least 2 stops to optimize")
    
    stops = stops_response.data
    
    optimization_result = await optimize_route(stops)
    
    if not optimization_result:
        raise HTTPException(status_code=500, detail="Failed to optimize route")
    
    optimized_stops = optimization_result['stops']
    
    start_time = datetime.now()
    current_time = start_time
    
    for stop in optimized_stops:
        stop_update = {
            'sequence_order': stop['sequence_order'],
            'arrival_time': current_time.isoformat()
        }
        
        supabase.table("stops").update(stop_update).eq("id", stop['id']).execute()
        
        current_time += timedelta(seconds=stop.get('estimated_duration_seconds', 180))
    
    route_update = {
        'status': 'optimized',
        'total_distance_meters': optimization_result['total_distance_meters'],
        'total_duration_seconds': optimization_result['total_duration_seconds']
    }
    
    supabase.table("routes").update(route_update).eq("id", route_id).execute()
    
    updated_route_response = supabase.table("routes").select("*").eq("id", route_id).execute()
    updated_stops_response = supabase.table("stops").select("*").eq("route_id", route_id).order("sequence_order").execute()
    
    stops_list = [StopResponse(**stop) for stop in updated_stops_response.data]
    
    return RouteWithStops(**updated_route_response.data[0], stops=stops_list)
