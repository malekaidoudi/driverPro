import googlemaps
from app.core.config import get_settings
from typing import List, Dict, Tuple
import asyncio
from functools import lru_cache

settings = get_settings()


@lru_cache()
def get_gmaps_client():
    return googlemaps.Client(key=settings.google_maps_api_key)


async def get_distance_matrix(
    origins: List[Tuple[float, float]], 
    destinations: List[Tuple[float, float]],
    mode: str = "driving",
    use_traffic: bool = True
) -> Dict:
    """
    Get distance matrix with optional real-time traffic.
    
    Args:
        origins: List of (lat, lng) tuples
        destinations: List of (lat, lng) tuples  
        mode: Travel mode (driving, walking, bicycling, transit)
        use_traffic: If True, uses real-time traffic data (driving only)
    """
    gmaps = get_gmaps_client()
    
    import datetime
    
    kwargs = {
        "origins": origins,
        "destinations": destinations,
        "mode": mode,
        "units": "metric"
    }
    
    # Add traffic parameters for driving mode
    if use_traffic and mode == "driving":
        kwargs["departure_time"] = datetime.datetime.now()
        kwargs["traffic_model"] = "best_guess"
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: gmaps.distance_matrix(**kwargs)
    )
    
    return result


async def geocode_address(address: str) -> List[Dict]:
    gmaps = get_gmaps_client()
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: gmaps.geocode(address)
    )
    
    return result if result else []


async def autocomplete_address(input_text: str, location: Tuple[float, float] = None) -> List[Dict]:
    gmaps = get_gmaps_client()
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: gmaps.places_autocomplete(
            input_text=input_text,
            location=location,
            radius=50000
        )
    )
    
    return result


async def get_place_details(place_id: str) -> Dict:
    gmaps = get_gmaps_client()
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: gmaps.place(place_id=place_id)
    )
    
    return result
