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
    mode: str = "driving"
) -> Dict:
    gmaps = get_gmaps_client()
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        lambda: gmaps.distance_matrix(
            origins=origins,
            destinations=destinations,
            mode=mode,
            units="metric"
        )
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
