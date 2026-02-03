import axios from 'axios';
import {
    Route,
    Stop,
    RouteGroupedByDate,
    PlacePrediction,
    PlaceDetails,
    OcrScanResult,
    SpeechRecognitionResult,
    FavoriteStop,
    FavoriteStopCreateData,
    RecurringStop,
    RecurringStopCreateData,
    DeliveryAttempt,
    DeliveryFailureData,
    DeliveryFailureResult,
} from '../types';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
    authToken = token;
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

api.interceptors.request.use(async (config) => {
    config.headers = config.headers ?? {};

    const existingAuth = (config.headers as any)['Authorization'];
    if (existingAuth) return config;

    if (authToken) {
        (config.headers as any)['Authorization'] = `Bearer ${authToken}`;
        return config;
    }

    try {
        const { supabase } = await import('./supabase');
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? null;
        if (token) {
            authToken = token;
            (config.headers as any)['Authorization'] = `Bearer ${token}`;
        }
    } catch {
        // ignore
    }

    return config;
});

export const routesApi = {
    getAll: async (): Promise<RouteGroupedByDate[]> => {
        const response = await api.get('/routes');
        return response.data;
    },

    getById: async (routeId: string): Promise<Route> => {
        const response = await api.get(`/routes/${routeId}`);
        return response.data;
    },

    create: async (data: { name: string; route_date: string; start_address?: string; end_address?: string }): Promise<Route> => {
        const response = await api.post('/routes', data);
        return response.data;
    },

    update: async (routeId: string, data: Partial<Route>): Promise<Route> => {
        const response = await api.put(`/routes/${routeId}`, data);
        return response.data;
    },

    delete: async (routeId: string): Promise<void> => {
        await api.delete(`/routes/${routeId}`);
    },

    optimize: async (routeId: string): Promise<Route> => {
        const response = await api.post(`/routes/${routeId}/optimize`);
        return response.data;
    },
};

export const stopsApi = {
    create: async (routeId: string, data: Partial<Stop>): Promise<Stop> => {
        const response = await api.post(`/routes/${routeId}/stops`, data);
        return response.data;
    },

    createBatch: async (routeId: string, stops: Partial<Stop>[]): Promise<Stop[]> => {
        const response = await api.post(`/routes/${routeId}/stops/batch`, { stops });
        return response.data;
    },

    update: async (routeId: string, stopId: string, data: Partial<Stop>): Promise<Stop> => {
        const response = await api.put(`/routes/${routeId}/stops/${stopId}`, data);
        return response.data;
    },

    delete: async (routeId: string, stopId: string): Promise<void> => {
        await api.delete(`/routes/${routeId}/stops/${stopId}`);
    },

    recordFailure: async (stopId: string, data: DeliveryFailureData): Promise<DeliveryFailureResult> => {
        const response = await api.post(`/stops/${stopId}/fail`, data);
        return response.data;
    },

    getAttempts: async (stopId: string): Promise<DeliveryAttempt[]> => {
        const response = await api.get(`/stops/${stopId}/attempts`);
        return response.data;
    },
};

export const favoriteStopsApi = {
    getAll: async (): Promise<FavoriteStop[]> => {
        const response = await api.get('/favorite-stops');
        return response.data;
    },

    create: async (data: FavoriteStopCreateData): Promise<FavoriteStop> => {
        const response = await api.post('/favorite-stops', data);
        return response.data;
    },

    update: async (stopId: string, data: Partial<FavoriteStopCreateData>): Promise<FavoriteStop> => {
        const response = await api.put(`/favorite-stops/${stopId}`, data);
        return response.data;
    },

    delete: async (stopId: string): Promise<void> => {
        await api.delete(`/favorite-stops/${stopId}`);
    },

    addToRoute: async (stopId: string, routeId: string, options?: { package_count?: number; order_preference?: string; notes?: string }): Promise<Stop> => {
        const response = await api.post(`/favorite-stops/${stopId}/add-to-route/${routeId}`, options || {});
        return response.data;
    },
};

export const recurringStopsApi = {
    getAll: async (): Promise<RecurringStop[]> => {
        const response = await api.get('/recurring-stops');
        return response.data;
    },

    create: async (data: RecurringStopCreateData): Promise<RecurringStop> => {
        const response = await api.post('/recurring-stops', data);
        return response.data;
    },

    update: async (stopId: string, data: Partial<RecurringStopCreateData>): Promise<RecurringStop> => {
        const response = await api.put(`/recurring-stops/${stopId}`, data);
        return response.data;
    },

    delete: async (stopId: string): Promise<void> => {
        await api.delete(`/recurring-stops/${stopId}`);
    },

    toggle: async (stopId: string, isActive: boolean): Promise<RecurringStop> => {
        const response = await api.patch(`/recurring-stops/${stopId}`, { is_active: isActive });
        return response.data;
    },
};

export const servicesApi = {
    autocomplete: async (input: string, lat?: number, lng?: number): Promise<PlacePrediction[]> => {
        const params: any = { input };
        if (lat && lng) {
            params.lat = lat;
            params.lng = lng;
        }
        const response = await api.get('/services/geocode/autocomplete', { params });
        return response.data.predictions;
    },

    getPlaceDetails: async (placeId: string): Promise<PlaceDetails> => {
        const response = await api.get('/services/geocode/details', {
            params: { place_id: placeId },
        });
        return response.data;
    },

    scanAddress: async (imageUri: string): Promise<OcrScanResult> => {
        const formData = new FormData();
        formData.append('file', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'address.jpg',
        } as any);

        const response = await api.post('/services/ocr/scan-address', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    recognizeSpeech: async (audioUri: string): Promise<SpeechRecognitionResult> => {
        const formData = new FormData();
        formData.append('file', {
            uri: audioUri,
            type: 'audio/wav',
            name: 'audio.wav',
        } as any);

        const response = await api.post('/services/speech/recognize', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    geocodeAddress: async (address: string): Promise<{
        latitude: number;
        longitude: number;
        formatted_address: string;
    }> => {
        const response = await api.get('/services/geocode/address', {
            params: { address },
        });
        return response.data;
    },
};

export default api;
