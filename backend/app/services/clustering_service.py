"""
Clustering service for large route optimization (>25 stops).
Uses K-means to split stops into manageable clusters, then optimizes each cluster
and the inter-cluster order.
"""

from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
import numpy as np
from sklearn.cluster import KMeans
import math


@dataclass
class ClusterConfig:
    """Configuration for clustering."""
    max_stops_per_cluster: int = 25  # Google Maps limit
    min_clusters: int = 2
    max_clusters: int = 10
    

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def haversine_to_duration(distance_meters: float, avg_speed_kmh: float = 30) -> int:
    """
    Convert Haversine distance to estimated duration in seconds.
    Uses average urban speed (30 km/h by default).
    """
    speed_ms = avg_speed_kmh * 1000 / 3600  # Convert to m/s
    return int(distance_meters / speed_ms)


def create_haversine_matrix(
    locations: List[Tuple[float, float]],
    avg_speed_kmh: float = 30
) -> Tuple[List[List[int]], List[List[int]]]:
    """
    Create distance and duration matrices using Haversine formula.
    Much faster and free compared to Google Maps API.
    
    Args:
        locations: List of (lat, lng) tuples
        avg_speed_kmh: Average speed for duration estimation
        
    Returns:
        (distance_matrix, duration_matrix) in meters and seconds
    """
    n = len(locations)
    distance_matrix = [[0] * n for _ in range(n)]
    duration_matrix = [[0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                dist = haversine_distance(
                    locations[i][0], locations[i][1],
                    locations[j][0], locations[j][1]
                )
                distance_matrix[i][j] = int(dist)
                duration_matrix[i][j] = haversine_to_duration(dist, avg_speed_kmh)
    
    return distance_matrix, duration_matrix


def cluster_stops(
    stops: List[Dict],
    config: ClusterConfig = None
) -> List[List[Dict]]:
    """
    Cluster stops using K-means algorithm.
    
    Args:
        stops: List of stops with 'latitude' and 'longitude'
        config: Clustering configuration
        
    Returns:
        List of clusters, each containing a list of stops
    """
    if config is None:
        config = ClusterConfig()
    
    n_stops = len(stops)
    
    # No clustering needed for small sets
    if n_stops <= config.max_stops_per_cluster:
        return [stops]
    
    # Calculate optimal number of clusters
    n_clusters = min(
        max(config.min_clusters, math.ceil(n_stops / config.max_stops_per_cluster)),
        config.max_clusters
    )
    
    # Prepare coordinates for K-means
    coords = np.array([
        [stop['latitude'], stop['longitude']] 
        for stop in stops
    ])
    
    # Run K-means clustering
    kmeans = KMeans(
        n_clusters=n_clusters,
        random_state=42,
        n_init=10
    )
    labels = kmeans.fit_predict(coords)
    
    # Group stops by cluster
    clusters = [[] for _ in range(n_clusters)]
    for i, stop in enumerate(stops):
        cluster_idx = labels[i]
        clusters[cluster_idx].append(stop)
    
    # Remove empty clusters
    clusters = [c for c in clusters if len(c) > 0]
    
    return clusters


def get_cluster_centroid(stops: List[Dict]) -> Tuple[float, float]:
    """Calculate centroid of a cluster."""
    if not stops:
        return (0.0, 0.0)
    
    lat_sum = sum(s['latitude'] for s in stops)
    lng_sum = sum(s['longitude'] for s in stops)
    n = len(stops)
    
    return (lat_sum / n, lng_sum / n)


def optimize_cluster_order(
    clusters: List[List[Dict]],
    start_location: Tuple[float, float] = None,
    end_location: Tuple[float, float] = None
) -> List[int]:
    """
    Optimize the order of visiting clusters using nearest neighbor heuristic.
    For small number of clusters, this is efficient.
    
    Args:
        clusters: List of clusters
        start_location: Starting point
        end_location: Ending point (optional)
        
    Returns:
        Ordered list of cluster indices
    """
    n_clusters = len(clusters)
    
    if n_clusters <= 1:
        return list(range(n_clusters))
    
    # Get centroids
    centroids = [get_cluster_centroid(c) for c in clusters]
    
    # Nearest neighbor heuristic
    visited = [False] * n_clusters
    order = []
    
    # Start from cluster closest to start_location
    if start_location:
        current_pos = start_location
    else:
        # Start from first cluster centroid
        current_pos = centroids[0]
        order.append(0)
        visited[0] = True
    
    while len(order) < n_clusters:
        best_idx = -1
        best_dist = float('inf')
        
        for i in range(n_clusters):
            if visited[i]:
                continue
            
            dist = haversine_distance(
                current_pos[0], current_pos[1],
                centroids[i][0], centroids[i][1]
            )
            
            if dist < best_dist:
                best_dist = dist
                best_idx = i
        
        if best_idx >= 0:
            order.append(best_idx)
            visited[best_idx] = True
            current_pos = centroids[best_idx]
    
    # If end_location specified, try 2-opt improvement
    if end_location and len(order) > 2:
        order = _two_opt_improve(order, centroids, start_location, end_location)
    
    return order


def _two_opt_improve(
    order: List[int],
    centroids: List[Tuple[float, float]],
    start: Tuple[float, float],
    end: Tuple[float, float]
) -> List[int]:
    """Apply 2-opt improvement to cluster order."""
    improved = True
    best_order = order.copy()
    
    def total_distance(o):
        dist = 0
        if start:
            dist += haversine_distance(start[0], start[1], centroids[o[0]][0], centroids[o[0]][1])
        for i in range(len(o) - 1):
            dist += haversine_distance(
                centroids[o[i]][0], centroids[o[i]][1],
                centroids[o[i+1]][0], centroids[o[i+1]][1]
            )
        if end:
            dist += haversine_distance(centroids[o[-1]][0], centroids[o[-1]][1], end[0], end[1])
        return dist
    
    best_dist = total_distance(best_order)
    
    while improved:
        improved = False
        for i in range(len(best_order) - 1):
            for j in range(i + 2, len(best_order)):
                new_order = best_order[:i+1] + best_order[i+1:j+1][::-1] + best_order[j+1:]
                new_dist = total_distance(new_order)
                if new_dist < best_dist:
                    best_order = new_order
                    best_dist = new_dist
                    improved = True
    
    return best_order


def get_adaptive_config(n_stops: int) -> Dict:
    """
    Get adaptive optimization config based on number of stops.
    
    Returns dict with time_limit and num_starts.
    """
    if n_stops < 15:
        return {'time_limit_seconds': 10, 'num_starts': 3}
    elif n_stops < 40:
        return {'time_limit_seconds': 30, 'num_starts': 5}
    elif n_stops < 70:
        return {'time_limit_seconds': 45, 'num_starts': 5}
    else:
        return {'time_limit_seconds': 60, 'num_starts': 5}
