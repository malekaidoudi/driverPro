export enum RouteStatus {
    DRAFT = 'draft',
    OPTIMIZED = 'optimized',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed'
}

export enum StopType {
    DELIVERY = 'delivery',
    COLLECTION = 'collection',
    BREAK = 'break'
}

export enum StopStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    SKIPPED = 'skipped'
}

export enum StopPriority {
    NORMAL = 'normal',
    HIGH = 'high',
    URGENT = 'urgent'
}

export interface Stop {
    id: string;
    route_id: string;
    sequence_order?: number;
    address: string;
    latitude: number;
    longitude: number;
    notes?: string;
    type: StopType;
    priority: StopPriority;
    status: StopStatus;
    arrival_time?: string;
    departure_time?: string;
    estimated_duration_seconds: number;
    package_count: number;
    package_finder_id?: string;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    time_window_start?: string;
    time_window_end?: string;
    package_weight_kg?: number;
    package_size?: string;
    is_fragile?: boolean;
    created_at: string;
}

export interface StopCreateData {
    address: string;
    latitude: number;
    longitude: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    notes?: string;
    type?: StopType;
    priority?: StopPriority;
    time_window_start?: string;
    time_window_end?: string;
    package_count?: number;
    package_weight_kg?: number;
    package_size?: string;
    is_fragile?: boolean;
}

export interface OcrScanResult {
    success: boolean;
    raw_text?: string;
    candidates?: string[];
    extracted_address?: string;
    latitude?: number;
    longitude?: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    message?: string;
}

export interface SpeechRecognitionResult {
    success: boolean;
    transcript?: string;
    confidence?: number;
    message?: string;
}

export interface Route {
    id: string;
    user_id: string;
    name: string;
    route_date: string;
    status: RouteStatus;
    total_distance_meters?: number;
    total_duration_seconds?: number;
    created_at: string;
    updated_at: string;
    stops?: Stop[];
}

export interface RouteGroupedByDate {
    date: string;
    routes: Route[];
}

export interface User {
    id: string;
    email: string;
    full_name?: string;
}

export interface UserPreferences {
    user_id: string;
    theme: 'light' | 'dark' | 'system';
    default_stop_duration_minutes: number;
    default_vehicle_type: 'car' | 'truck' | 'bike';
    avoid_tolls: boolean;
    navigation_app: 'google_maps' | 'waze' | 'apple_maps';
}

export interface PlacePrediction {
    description: string;
    place_id: string;
    structured_formatting: {
        main_text: string;
        secondary_text: string;
    };
}

export interface PlaceDetails {
    address: string;
    latitude: number;
    longitude: number;
    place_id: string;
}
