from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from typing import List, Dict, Tuple, Optional
from app.services.google_maps_service import get_distance_matrix
import asyncio
import random
from dataclasses import dataclass
from enum import Enum


class Metaheuristic(str, Enum):
    """Available metaheuristics for route optimization."""
    GUIDED_LOCAL_SEARCH = "guided_local_search"
    TABU_SEARCH = "tabu_search"
    SIMULATED_ANNEALING = "simulated_annealing"
    AUTOMATIC = "automatic"


# Default service time per stop (seconds) - time spent at each delivery
DEFAULT_SERVICE_TIME = 120  # 2 minutes


@dataclass
class OptimizationConfig:
    """Configuration for route optimization."""
    time_limit_seconds: int = 120  # Increased from 30s
    num_starts: int = 10  # Multi-start with different seeds
    metaheuristic: Metaheuristic = Metaheuristic.GUIDED_LOCAL_SEARCH
    optimize_for_duration: bool = True  # True = duration, False = distance
    use_traffic: bool = True  # Use real-time traffic
    log_search: bool = False  # Enable search logging
    use_full_propagation: bool = True  # Better constraint propagation
    service_time_seconds: int = DEFAULT_SERVICE_TIME  # Time spent at each stop
    enable_clustering: bool = True  # Auto-cluster if > 40 stops
    max_stops_per_cluster: int = 40  # Optimal cluster size
    use_haversine_precompute: bool = True  # Use Haversine for optimization, Google for final
    
    @classmethod
    def quick(cls) -> 'OptimizationConfig':
        """Fast config for mobile app (live optimization)."""
        return cls(
            time_limit_seconds=30,
            num_starts=3,
            metaheuristic=Metaheuristic.GUIDED_LOCAL_SEARCH,
        )
    
    @classmethod
    def precise(cls) -> 'OptimizationConfig':
        """Precise config for batch planning."""
        return cls(
            time_limit_seconds=300,
            num_starts=20,
            metaheuristic=Metaheuristic.TABU_SEARCH,
        )
    
    @classmethod
    def for_stop_count(cls, n_stops: int) -> 'OptimizationConfig':
        """Adaptive config based on number of stops."""
        if n_stops < 15:
            return cls(time_limit_seconds=10, num_starts=3)
        elif n_stops < 40:
            return cls(time_limit_seconds=30, num_starts=5)
        elif n_stops < 70:
            return cls(time_limit_seconds=45, num_starts=5)
        else:
            return cls(time_limit_seconds=60, num_starts=5)


class VRPSolver:
    def __init__(
        self, 
        locations: List[Tuple[float, float]], 
        time_windows: List[Tuple[int, int]] = None,
        config: OptimizationConfig = None
    ):
        self.locations = locations
        self.num_locations = len(locations)
        self.time_windows = time_windows
        self.config = config or OptimizationConfig()
        self.distance_matrix = None
        self.duration_matrix = None
    
    async def create_distance_matrix(self, use_haversine: bool = False):
        """
        Create distance/duration matrices.
        
        Args:
            use_haversine: If True, use Haversine approximation (free, fast).
                          If False, use Google Maps API (accurate, costs API calls).
        """
        if use_haversine or self.config.use_haversine_precompute:
            # Use fast Haversine approximation - no API cost
            from app.services.clustering_service import create_haversine_matrix
            self.distance_matrix, self.duration_matrix = create_haversine_matrix(
                self.locations,
                avg_speed_kmh=30  # Urban average
            )
            return self.distance_matrix, self.duration_matrix
        
        # Use Google Maps API for accurate distances
        result = await get_distance_matrix(
            self.locations, 
            self.locations,
            use_traffic=self.config.use_traffic
        )
        
        distance_matrix = []
        duration_matrix = []
        
        for row in result['rows']:
            distance_row = []
            duration_row = []
            for element in row['elements']:
                if element['status'] == 'OK':
                    distance_row.append(element['distance']['value'])
                    duration_row.append(element['duration']['value'])
                else:
                    distance_row.append(0)
                    duration_row.append(0)
            distance_matrix.append(distance_row)
            duration_matrix.append(duration_row)
        
        self.distance_matrix = distance_matrix
        self.duration_matrix = duration_matrix
        
        return distance_matrix, duration_matrix
    
    async def refine_with_google_maps(self, route: List[int]) -> Dict:
        """
        After optimization with Haversine, get accurate Google Maps data
        for the final route only. Reduces API calls dramatically.
        
        Args:
            route: Ordered list of location indices
            
        Returns:
            Dict with accurate distance/duration for the route
        """
        if len(route) < 2:
            return {'total_distance_meters': 0, 'total_duration_seconds': 0}
        
        # Get only the route locations in order
        route_locations = [self.locations[i] for i in route]
        
        # Call Google Maps for sequential pairs only (N-1 calls instead of N²)
        total_distance = 0
        total_duration = 0
        
        # Batch into origin-destination pairs
        origins = route_locations[:-1]
        destinations = route_locations[1:]
        
        result = await get_distance_matrix(
            origins,
            destinations,
            use_traffic=self.config.use_traffic
        )
        
        # Extract diagonal (sequential route segments)
        for i, row in enumerate(result['rows']):
            if i < len(row['elements']):
                element = row['elements'][i]
                if element['status'] == 'OK':
                    total_distance += element['distance']['value']
                    total_duration += element['duration']['value']
        
        return {
            'total_distance_meters': total_distance,
            'total_duration_seconds': total_duration
        }
    
    def solve(self, start_index: int = 0, end_index: int = None) -> Dict:
        if self.distance_matrix is None:
            raise ValueError("Distance matrix not created. Call create_distance_matrix() first.")
        
        if end_index is None:
            end_index = start_index
        
        # RoutingIndexManager avec start != end nécessite des listes
        if start_index == end_index:
            # Circuit fermé : départ = arrivée
            manager = pywrapcp.RoutingIndexManager(
                self.num_locations,
                1,  # 1 véhicule
                start_index  # depot unique
            )
        else:
            # Trajet ouvert : départ != arrivée (listes requises)
            manager = pywrapcp.RoutingIndexManager(
                self.num_locations,
                1,  # 1 véhicule
                [start_index],  # liste des départs
                [end_index]     # liste des arrivées
            )
        
        routing = pywrapcp.RoutingModel(manager)
        
        # Service time per stop (added to travel time)
        service_time = self.config.service_time_seconds
        
        # Choose optimization target: duration (with traffic) or distance
        # Include service time in cost for realistic optimization
        if self.config.optimize_for_duration:
            def transit_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                travel_time = self.duration_matrix[from_node][to_node]
                # Add service time at destination (except for depot)
                if to_node != start_index and to_node != end_index:
                    return travel_time + service_time
                return travel_time
        else:
            def transit_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                return self.distance_matrix[from_node][to_node]
        
        transit_callback_index = routing.RegisterTransitCallback(transit_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        # Time dimension with service time for accurate time tracking
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel_time = self.duration_matrix[from_node][to_node]
            # Add service time at destination (except for depot)
            if to_node != start_index and to_node != end_index:
                return travel_time + service_time
            return travel_time
        
        time_callback_index = routing.RegisterTransitCallback(time_callback)
        routing.AddDimension(
            time_callback_index,
            30 * 60,      # 30 min slack (waiting time)
            24 * 60 * 60, # 24h max horizon
            False,
            'Time'
        )
        
        # Apply time windows constraints if provided
        if self.time_windows:
            time_dimension = routing.GetDimensionOrDie('Time')
            for location_idx, time_window in enumerate(self.time_windows):
                if location_idx == start_index:
                    continue
                index = manager.NodeToIndex(location_idx)
                time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])
        
        # Configure search parameters with improvements
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        
        # Better initial solution strategy
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
        )
        
        # Configurable metaheuristic
        metaheuristic_map = {
            Metaheuristic.GUIDED_LOCAL_SEARCH: routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH,
            Metaheuristic.TABU_SEARCH: routing_enums_pb2.LocalSearchMetaheuristic.TABU_SEARCH,
            Metaheuristic.SIMULATED_ANNEALING: routing_enums_pb2.LocalSearchMetaheuristic.SIMULATED_ANNEALING,
            Metaheuristic.AUTOMATIC: routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC,
        }
        search_parameters.local_search_metaheuristic = metaheuristic_map.get(
            self.config.metaheuristic,
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        
        # Time limit per iteration (will be divided by num_starts)
        time_per_start = max(10, self.config.time_limit_seconds // self.config.num_starts)
        search_parameters.time_limit.seconds = time_per_start
        
        # Advanced options
        search_parameters.log_search = self.config.log_search
        search_parameters.use_full_propagation = self.config.use_full_propagation
        
        # Multi-start optimization: run multiple times with different seeds
        best_solution = None
        best_cost = float('inf')
        
        for i in range(self.config.num_starts):
            # Set random seed for diversity
            search_parameters.random_seed = random.randint(1, 100000)
            
            solution = routing.SolveWithParameters(search_parameters)
            
            if solution:
                cost = solution.ObjectiveValue()
                if cost < best_cost:
                    best_cost = cost
                    best_solution = self._extract_solution(manager, routing, solution)
        
        return best_solution
    
    def _extract_solution(self, manager, routing, solution) -> Dict:
        route = []
        index = routing.Start(0)
        total_distance = 0
        total_duration = 0
        
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            route.append(node_index)
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            total_distance += routing.GetArcCostForVehicle(previous_index, index, 0)
        
        route.append(manager.IndexToNode(index))
        
        for i in range(len(route) - 1):
            total_duration += self.duration_matrix[route[i]][route[i + 1]]
        
        return {
            'route': route,
            'total_distance_meters': total_distance,
            'total_duration_seconds': total_duration
        }


async def optimize_route(
    stops: List[Dict],
    start_location: Tuple[float, float] = None,
    end_location: Tuple[float, float] = None,
    config: OptimizationConfig = None
) -> Dict:
    """
    Optimize route with support for order_preference:
    - 'first': Stop must be at the beginning of the route
    - 'auto': Stop can be placed anywhere (default)
    - 'last': Stop must be at the end of the route
    
    Args:
        stops: List of stops with latitude, longitude, order_preference
        start_location: Starting point (lat, lng)
        end_location: Ending point (lat, lng)
        config: Optimization configuration (time limit, metaheuristic, etc.)
    """
    if config is None:
        config = OptimizationConfig()
    # Separate stops by order preference
    first_stops = [s for s in stops if s.get('order_preference') == 'first']
    auto_stops = [s for s in stops if s.get('order_preference', 'auto') == 'auto']
    last_stops = [s for s in stops if s.get('order_preference') == 'last']
    
    # If all stops are fixed (first or last), no optimization needed for middle
    if not auto_stops:
        # Just order: first_stops + last_stops
        result_stops = []
        for i, stop in enumerate(first_stops + last_stops):
            stop_copy = stop.copy()
            stop_copy['sequence_order'] = i + 1
            result_stops.append(stop_copy)
        return {
            'stops': result_stops,
            'total_distance_meters': 0,
            'total_duration_seconds': 0
        }
    
    # Build locations for optimization (only auto stops)
    locations = []
    
    if start_location:
        locations.append(start_location)
        start_index = 0
    else:
        start_index = 0
    
    for stop in auto_stops:
        locations.append((stop['latitude'], stop['longitude']))
    
    if end_location and end_location != start_location:
        locations.append(end_location)
        end_index = len(locations) - 1
    else:
        end_index = start_index if start_location else 0
    
    solver = VRPSolver(locations, config=config)
    
    # Use Haversine for optimization (fast, free)
    # Then refine with Google Maps for accurate final distances
    await solver.create_distance_matrix(use_haversine=config.use_haversine_precompute)
    
    solution = solver.solve(start_index=start_index, end_index=end_index)
    
    if not solution:
        return None
    
    # If we used Haversine, get accurate distances from Google Maps for final route
    if config.use_haversine_precompute and len(solution['route']) > 1:
        refined = await solver.refine_with_google_maps(solution['route'])
        solution['total_distance_meters'] = refined['total_distance_meters']
        solution['total_duration_seconds'] = refined['total_duration_seconds']
    
    # Build optimized auto stops
    optimized_auto_stops = []
    offset = 1 if start_location else 0
    
    for i, node_index in enumerate(solution['route']):
        if node_index == start_index or (end_location and node_index == end_index):
            continue
        
        stop_index = node_index - offset
        if 0 <= stop_index < len(auto_stops):
            stop = auto_stops[stop_index].copy()
            optimized_auto_stops.append(stop)
    
    # Combine: first_stops + optimized_auto_stops + last_stops
    final_stops = []
    sequence = 1
    
    for stop in first_stops:
        stop_copy = stop.copy()
        stop_copy['sequence_order'] = sequence
        final_stops.append(stop_copy)
        sequence += 1
    
    for stop in optimized_auto_stops:
        stop['sequence_order'] = sequence
        final_stops.append(stop)
        sequence += 1
    
    for stop in last_stops:
        stop_copy = stop.copy()
        stop_copy['sequence_order'] = sequence
        final_stops.append(stop_copy)
        sequence += 1
    
    return {
        'stops': final_stops,
        'total_distance_meters': solution['total_distance_meters'],
        'total_duration_seconds': solution['total_duration_seconds']
    }


async def optimize_route_with_clustering(
    stops: List[Dict],
    start_location: Tuple[float, float] = None,
    end_location: Tuple[float, float] = None,
    config: OptimizationConfig = None
) -> Dict:
    """
    Optimize route with automatic clustering for large stop sets (>40 stops).
    
    Architecture:
    1. Cluster stops geographically (K-means)
    2. Optimize each cluster with OR-Tools (using Haversine)
    3. Optimize inter-cluster order (Nearest Neighbor + 2-opt)
    4. Combine results
    5. Refine final route with Google Maps for accurate distances
    
    Cost savings:
    - 100 stops: 10,000 API calls → ~200 API calls (50x reduction)
    
    Args:
        stops: List of stops with latitude, longitude, order_preference
        start_location: Starting point (lat, lng)
        end_location: Ending point (lat, lng)
        config: Optimization configuration
    """
    from app.services.clustering_service import (
        cluster_stops, 
        optimize_cluster_order, 
        ClusterConfig,
        get_cluster_centroid
    )
    
    if config is None:
        config = OptimizationConfig.for_stop_count(len(stops))
    
    # Separate stops by order preference
    first_stops = [s for s in stops if s.get('order_preference') == 'first']
    auto_stops = [s for s in stops if s.get('order_preference', 'auto') == 'auto']
    last_stops = [s for s in stops if s.get('order_preference') == 'last']
    
    # If no auto stops or clustering disabled, use regular optimization
    if not auto_stops or not config.enable_clustering or len(auto_stops) <= config.max_stops_per_cluster:
        return await optimize_route(stops, start_location, end_location, config)
    
    # Step 1: Cluster auto stops
    cluster_config = ClusterConfig(max_stops_per_cluster=config.max_stops_per_cluster)
    clusters = cluster_stops(auto_stops, cluster_config)
    
    print(f"[Clustering] Split {len(auto_stops)} stops into {len(clusters)} clusters")
    
    # Step 2: Optimize inter-cluster order
    cluster_order = optimize_cluster_order(clusters, start_location, end_location)
    ordered_clusters = [clusters[i] for i in cluster_order]
    
    # Step 3: Optimize each cluster
    all_optimized_stops = []
    total_distance = 0
    total_duration = 0
    
    for cluster_idx, cluster in enumerate(ordered_clusters):
        # Determine entry/exit points for this cluster
        if cluster_idx == 0:
            cluster_start = start_location
        else:
            # Use centroid of previous cluster as start
            cluster_start = get_cluster_centroid(ordered_clusters[cluster_idx - 1])
        
        if cluster_idx == len(ordered_clusters) - 1:
            cluster_end = end_location
        else:
            # Use centroid of next cluster as end
            cluster_end = get_cluster_centroid(ordered_clusters[cluster_idx + 1])
        
        # Optimize this cluster
        cluster_result = await optimize_route(
            cluster,
            start_location=cluster_start,
            end_location=cluster_end,
            config=config
        )
        
        if cluster_result:
            all_optimized_stops.extend(cluster_result['stops'])
            total_distance += cluster_result['total_distance_meters']
            total_duration += cluster_result['total_duration_seconds']
    
    # Step 4: Combine with first/last stops and assign final sequence
    final_stops = []
    sequence = 1
    
    for stop in first_stops:
        stop_copy = stop.copy()
        stop_copy['sequence_order'] = sequence
        final_stops.append(stop_copy)
        sequence += 1
    
    for stop in all_optimized_stops:
        stop['sequence_order'] = sequence
        final_stops.append(stop)
        sequence += 1
    
    for stop in last_stops:
        stop_copy = stop.copy()
        stop_copy['sequence_order'] = sequence
        final_stops.append(stop_copy)
        sequence += 1
    
    return {
        'stops': final_stops,
        'total_distance_meters': total_distance,
        'total_duration_seconds': total_duration,
        'clusters_used': len(clusters)
    }
