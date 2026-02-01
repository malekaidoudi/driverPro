from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp
from typing import List, Dict, Tuple
from app.services.google_maps_service import get_distance_matrix
import asyncio


class VRPSolver:
    def __init__(self, locations: List[Tuple[float, float]], time_windows: List[Tuple[int, int]] = None):
        self.locations = locations
        self.num_locations = len(locations)
        self.time_windows = time_windows
        self.distance_matrix = None
        self.duration_matrix = None
    
    async def create_distance_matrix(self):
        result = await get_distance_matrix(self.locations, self.locations)
        
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
        
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return self.distance_matrix[from_node][to_node]
        
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        
        if self.time_windows:
            def time_callback(from_index, to_index):
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                return self.duration_matrix[from_node][to_node]
            
            time_callback_index = routing.RegisterTransitCallback(time_callback)
            routing.AddDimension(
                time_callback_index,
                30 * 60,
                24 * 60 * 60,
                False,
                'Time'
            )
            time_dimension = routing.GetDimensionOrDie('Time')
            
            for location_idx, time_window in enumerate(self.time_windows):
                if location_idx == start_index:
                    continue
                index = manager.NodeToIndex(location_idx)
                time_dimension.CumulVar(index).SetRange(time_window[0], time_window[1])
        
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        search_parameters.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        search_parameters.time_limit.seconds = 30
        
        solution = routing.SolveWithParameters(search_parameters)
        
        if solution:
            return self._extract_solution(manager, routing, solution)
        else:
            return None
    
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
    end_location: Tuple[float, float] = None
) -> Dict:
    locations = []
    
    if start_location:
        locations.append(start_location)
        start_index = 0
    else:
        start_index = 0
    
    for stop in stops:
        locations.append((stop['latitude'], stop['longitude']))
    
    if end_location and end_location != start_location:
        locations.append(end_location)
        end_index = len(locations) - 1
    else:
        end_index = start_index if start_location else 0
    
    solver = VRPSolver(locations)
    await solver.create_distance_matrix()
    
    solution = solver.solve(start_index=start_index, end_index=end_index)
    
    if not solution:
        return None
    
    optimized_stops = []
    offset = 1 if start_location else 0
    
    for i, node_index in enumerate(solution['route']):
        if node_index == start_index or (end_location and node_index == end_index):
            continue
        
        stop_index = node_index - offset
        if 0 <= stop_index < len(stops):
            stop = stops[stop_index].copy()
            stop['sequence_order'] = i
            optimized_stops.append(stop)
    
    return {
        'stops': optimized_stops,
        'total_distance_meters': solution['total_distance_meters'],
        'total_duration_seconds': solution['total_duration_seconds']
    }
