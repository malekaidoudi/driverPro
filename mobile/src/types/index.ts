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
    SKIPPED = 'skipped',
    RESCHEDULED = 'rescheduled'
}

export enum OrderPreference {
    FIRST = 'first',
    AUTO = 'auto',
    LAST = 'last'
}

export enum FailureType {
    ABSENT = 'absent',
    RESCHEDULED = 'rescheduled',
    NO_ACCESS = 'no_access'
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
    address_complement?: string;
    postal_code?: string;
    city?: string;
    latitude: number;
    longitude: number;
    notes?: string;
    type: StopType;
    priority: StopPriority;
    order_preference: OrderPreference;
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
    attempt_count: number;
    last_failure_type?: FailureType;
    favorite_stop_id?: string;
    recurring_stop_id?: string;
    created_at: string;
}

export interface StopCreateData {
    address: string;
    address_complement?: string;
    postal_code?: string;
    city?: string;
    latitude: number;
    longitude: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    notes?: string;
    type?: StopType;
    priority?: StopPriority;
    order_preference?: OrderPreference;
    time_window_start?: string;
    time_window_end?: string;
    package_count?: number;
    package_weight_kg?: number;
    package_size?: string;
    is_fragile?: boolean;
    is_favorite?: boolean;
    is_recurring?: boolean;
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
    navigation_always_ask: boolean;
}

// Favorite Stops
export interface FavoriteStop {
    id: string;
    user_id: string;
    address: string;
    address_complement?: string;
    postal_code?: string;
    city?: string;
    latitude: number;
    longitude: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    label?: string;
    usage_count: number;
    last_used_at?: string;
    created_at: string;
}

export interface FavoriteStopCreateData {
    address: string;
    address_complement?: string;
    postal_code?: string;
    city?: string;
    latitude: number;
    longitude: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    label?: string;
}

// Recurring Stops
export interface RecurringStop {
    id: string;
    user_id: string;
    address: string;
    address_complement?: string;
    postal_code?: string;
    city?: string;
    latitude: number;
    longitude: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    is_active: boolean;
    days_of_week: number[];
    default_package_count: number;
    default_order_preference: OrderPreference;
    notes?: string;
    created_at: string;
}

export interface RecurringStopCreateData {
    address: string;
    address_complement?: string;
    postal_code?: string;
    city?: string;
    latitude: number;
    longitude: number;
    first_name?: string;
    last_name?: string;
    phone_number?: string;
    is_active?: boolean;
    days_of_week?: number[];
    default_package_count?: number;
    default_order_preference?: OrderPreference;
    notes?: string;
}

// Delivery Attempts
export interface DeliveryAttempt {
    id: string;
    stop_id: string;
    attempt_number: number;
    failure_type: FailureType;
    rescheduled_date?: string;
    rescheduled_route_id?: string;
    attempted_at: string;
    notes?: string;
}

export interface DeliveryFailureData {
    failure_type: FailureType;
    attempt_number: number;
    rescheduled_date?: string;
    notes?: string;
}

export interface DeliveryFailureResult {
    success: boolean;
    message: string;
    rescheduled_to?: string;
    new_stop_id?: string;
    new_route_id?: string;
    is_final_failure: boolean;
    attempt_count: number;
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
