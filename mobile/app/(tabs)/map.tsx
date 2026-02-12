import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Platform,
    Dimensions,
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
    Keyboard,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useTheme } from '../../src/contexts/ThemeContext';
import { servicesApi } from '../../src/services/api';
import { PlacePrediction } from '../../src/types';
import { MagnifyingGlass, Microphone, QrCode, MapPin, NavigationArrow, X, Crosshair, ArrowLeft, ArrowRight, ArrowUp, ArrowUUpLeft, ArrowUUpRight, XCircle, Camera, ClockCounterClockwise } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { MapPressEvent } from 'react-native-maps';

interface NavigationStep {
    instruction: string;
    distance: string;
    duration: string;
    maneuver?: string;
    startLocation: { latitude: number; longitude: number };
    endLocation: { latitude: number; longitude: number };
}

interface RoutePoint {
    address: string;
    latitude: number;
    longitude: number;
}

export default function MapScreen() {
    const { colors } = useTheme();
    const mapRef = useRef<MapView>(null);
    const screenHeight = Dimensions.get('window').height;

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [predictionsLoading, setPredictionsLoading] = useState(false);
    const [showPredictions, setShowPredictions] = useState(false);
    const [searchHistory, setSearchHistory] = useState<{ address: string; placeId: string }[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Load search history on mount
    useEffect(() => {
        (async () => {
            try {
                const history = await AsyncStorage.getItem('map_search_history');
                if (history) {
                    setSearchHistory(JSON.parse(history));
                }
            } catch (error) {
                console.error('Error loading search history:', error);
            }
        })();
    }, []);

    // Save address to history
    const saveToHistory = useCallback(async (address: string, placeId: string) => {
        try {
            const newEntry = { address, placeId };
            const updatedHistory = [newEntry, ...searchHistory.filter(h => h.placeId !== placeId)].slice(0, 5);
            setSearchHistory(updatedHistory);
            await AsyncStorage.setItem('map_search_history', JSON.stringify(updatedHistory));
        } catch (error) {
            console.error('Error saving to history:', error);
        }
    }, [searchHistory]);

    // User location - will be updated with real GPS
    const [userLocation, setUserLocation] = useState({
        latitude: 45.764043,
        longitude: 4.835659,
    });
    const [locationLoaded, setLocationLoaded] = useState(false);

    // Get real user location on mount
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const location = await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.Balanced,
                    });
                    setUserLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });
                    setLocationLoaded(true);
                }
            } catch (error) {
                console.error('Error getting location:', error);
                setLocationLoaded(true);
            }
        })();
    }, []);

    // Route state
    const [destination, setDestination] = useState<RoutePoint | null>(null);
    const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
    const [selectingFromMap, setSelectingFromMap] = useState(false);
    const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
    const [remainingInfo, setRemainingInfo] = useState<{ distance: string; duration: string } | null>(null);

    // Navigation state
    const [isNavigating, setIsNavigating] = useState(false);
    const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [currentLocation, setCurrentLocation] = useState(userLocation);
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);
    const currentStepRef = useRef(0);
    const lastRerouteTime = useRef(0);

    const mapRegion = useMemo(() => ({
        latitude: destination?.latitude || userLocation.latitude,
        longitude: destination?.longitude || userLocation.longitude,
        latitudeDelta: destination ? 0.05 : 0.1,
        longitudeDelta: destination ? 0.05 : 0.1,
    }), [destination, userLocation]);

    // Autocomplete effect
    useEffect(() => {
        const query = searchQuery.trim();
        if (query.length < 3) {
            setPredictions([]);
            setShowPredictions(false);
            return;
        }

        setPredictionsLoading(true);
        setShowPredictions(true);
        const timeout = setTimeout(async () => {
            try {
                const results = await servicesApi.autocomplete(query);
                setPredictions(results);
            } catch {
                setPredictions([]);
            } finally {
                setPredictionsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    // Select a prediction and get directions
    const selectPrediction = useCallback(async (prediction: PlacePrediction) => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const details = await servicesApi.getPlaceDetails(prediction.place_id);

            if (details?.latitude && details?.longitude) {
                const dest: RoutePoint = {
                    address: details.address,
                    latitude: details.latitude,
                    longitude: details.longitude,
                };
                setDestination(dest);
                setSearchQuery(prediction.structured_formatting?.main_text || prediction.description);
                setShowPredictions(false);
                setShowHistory(false);
                setPredictions([]);

                // Save to history
                await saveToHistory(details.address, prediction.place_id);

                // Dismiss keyboard
                Keyboard.dismiss();

                // Get directions
                await getDirections(userLocation, dest);

                // Fit map to show route
                mapRef.current?.fitToCoordinates(
                    [userLocation, { latitude: dest.latitude, longitude: dest.longitude }],
                    { edgePadding: { top: 100, right: 50, bottom: 200, left: 50 }, animated: true }
                );
            }
        } catch (error) {
            console.error('Error selecting prediction:', error);
        }
    }, [userLocation]);

    // Get directions from origin to destination with traffic
    const getDirections = async (origin: { latitude: number; longitude: number }, dest: RoutePoint, isReroute = false) => {
        try {
            // Use Google Directions API with traffic data
            const now = Math.floor(Date.now() / 1000);
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&departure_time=${now}&traffic_model=best_guess&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
            );
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const points = decodePolyline(route.overview_polyline.points);
                console.log('Route points decoded:', points.length);
                setRouteCoordinates(points);

                const leg = route.legs[0];
                // Use duration_in_traffic if available for more accurate ETA
                const duration = leg.duration_in_traffic?.text || leg.duration.text;
                setRouteInfo({
                    distance: leg.distance.text,
                    duration: duration,
                });
                setRemainingInfo({
                    distance: leg.distance.text,
                    duration: duration,
                });

                // Parse steps for navigation
                const steps: NavigationStep[] = leg.steps.map((step: any) => ({
                    instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
                    distance: step.distance.text,
                    duration: step.duration.text,
                    maneuver: step.maneuver,
                    startLocation: { latitude: step.start_location.lat, longitude: step.start_location.lng },
                    endLocation: { latitude: step.end_location.lat, longitude: step.end_location.lng },
                }));
                setNavigationSteps(steps);

                // Reset step index on reroute
                if (isReroute) {
                    setCurrentStepIndex(0);
                    currentStepRef.current = 0;
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            }
        } catch (error) {
            console.error('Error getting directions:', error);
        }
    };

    // Decode Google polyline
    const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
        const points: { latitude: number; longitude: number }[] = [];
        let index = 0, lat = 0, lng = 0;

        while (index < encoded.length) {
            let shift = 0, result = 0, byte;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            lat += (result & 1) ? ~(result >> 1) : (result >> 1);

            shift = 0;
            result = 0;
            do {
                byte = encoded.charCodeAt(index++) - 63;
                result |= (byte & 0x1f) << shift;
                shift += 5;
            } while (byte >= 0x20);
            lng += (result & 1) ? ~(result >> 1) : (result >> 1);

            points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
        }
        return points;
    };

    // Clear route
    const clearRoute = useCallback(() => {
        setDestination(null);
        setRouteCoordinates([]);
        setRouteInfo(null);
        setSearchQuery('');
        setSelectingFromMap(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    // Handle map press to select location
    const handleMapPress = useCallback(async (event: MapPressEvent) => {
        if (!selectingFromMap) return;

        const { latitude, longitude } = event.nativeEvent.coordinate;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // Reverse geocode to get address
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}`
            );
            const data = await response.json();
            const address = data.results?.[0]?.formatted_address || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

            const dest: RoutePoint = { address, latitude, longitude };
            setDestination(dest);
            setSearchQuery(address.split(',')[0]);
            setSelectingFromMap(false);

            await getDirections(userLocation, dest);

            mapRef.current?.fitToCoordinates(
                [userLocation, { latitude, longitude }],
                { edgePadding: { top: 100, right: 50, bottom: 200, left: 50 }, animated: true }
            );
        } catch (error) {
            console.error('Error getting address:', error);
        }
    }, [selectingFromMap, userLocation]);

    // Check if user is off route (more than 50m from nearest route point)
    const isOffRoute = useCallback((location: { latitude: number; longitude: number }, routePoints: { latitude: number; longitude: number }[]) => {
        if (routePoints.length === 0) return false;
        let minDistance = Infinity;
        for (const point of routePoints) {
            const dist = getDistanceBetweenPoints(location, point);
            if (dist < minDistance) minDistance = dist;
        }
        return minDistance > 50; // 50 meters threshold
    }, []);

    // Start in-app navigation
    const startNavigation = useCallback(async () => {
        if (!destination || navigationSteps.length === 0) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            console.error('Location permission denied');
            return;
        }

        setIsNavigating(true);
        setCurrentStepIndex(0);
        currentStepRef.current = 0;

        // Start tracking location
        locationSubscription.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.BestForNavigation,
                distanceInterval: 10,
                timeInterval: 2000,
            },
            async (location) => {
                const newLocation = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                };
                setCurrentLocation(newLocation);

                // Center map on current location during navigation
                mapRef.current?.animateToRegion({
                    ...newLocation,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }, 500);

                // Check if user is off route - reroute if needed
                const now = Date.now();
                if (isOffRoute(newLocation, routeCoordinates) && now - lastRerouteTime.current > 10000) {
                    console.log('User off route, recalculating...');
                    lastRerouteTime.current = now;
                    await getDirections(newLocation, destination, true);
                    return;
                }

                // Update remaining distance/time based on current position to destination
                const remainingDist = getDistanceBetweenPoints(newLocation, { latitude: destination.latitude, longitude: destination.longitude });
                const remainingKm = remainingDist / 1000;
                const avgSpeedKmh = 40; // Assume average speed
                const remainingMinutes = Math.round((remainingKm / avgSpeedKmh) * 60);
                setRemainingInfo({
                    distance: remainingKm < 1 ? `${Math.round(remainingDist)} m` : `${remainingKm.toFixed(1)} km`,
                    duration: remainingMinutes < 60 ? `${remainingMinutes} min` : `${Math.floor(remainingMinutes / 60)} h ${remainingMinutes % 60} min`,
                });

                // Check if user reached current step end location using ref for latest value
                setNavigationSteps(currentSteps => {
                    const stepIndex = currentStepRef.current;
                    if (currentSteps[stepIndex]) {
                        const stepEnd = currentSteps[stepIndex].endLocation;
                        const distance = getDistanceBetweenPoints(newLocation, stepEnd);
                        if (distance < 30 && stepIndex < currentSteps.length - 1) {
                            currentStepRef.current = stepIndex + 1;
                            setCurrentStepIndex(stepIndex + 1);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                    }
                    return currentSteps;
                });
            }
        );
    }, [destination, navigationSteps, routeCoordinates, isOffRoute]);

    // Stop navigation
    const stopNavigation = useCallback(() => {
        setIsNavigating(false);
        setCurrentStepIndex(0);
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    // Calculate distance between two points in meters
    const getDistanceBetweenPoints = (p1: { latitude: number; longitude: number }, p2: { latitude: number; longitude: number }) => {
        const R = 6371e3;
        const φ1 = p1.latitude * Math.PI / 180;
        const φ2 = p2.latitude * Math.PI / 180;
        const Δφ = (p2.latitude - p1.latitude) * Math.PI / 180;
        const Δλ = (p2.longitude - p1.longitude) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Get maneuver icon
    const getManeuverIcon = (maneuver?: string) => {
        switch (maneuver) {
            case 'turn-left':
                return <ArrowLeft size={32} color="#fff" weight="bold" />;
            case 'turn-right':
                return <ArrowRight size={32} color="#fff" weight="bold" />;
            case 'turn-sharp-left':
            case 'uturn-left':
                return <ArrowUUpLeft size={32} color="#fff" weight="bold" />;
            case 'turn-sharp-right':
            case 'uturn-right':
                return <ArrowUUpRight size={32} color="#fff" weight="bold" />;
            default:
                return <ArrowUp size={32} color="#fff" weight="bold" />;
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }
        };
    }, []);

    // UPS-themed map style - neutral highways to not conflict with route
    const upsMapStyle = [
        { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e0e0e0' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8e0d5' }] },
        { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c5b8a8' }] },
        { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f0ebe5' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8f5' }] },
        { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c5e8c5' }] },
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Map */}
            <MapView
                ref={mapRef}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                provider={PROVIDER_GOOGLE}
                region={mapRegion}
                showsUserLocation
                showsMyLocationButton={false}
                customMapStyle={upsMapStyle}
                onPress={handleMapPress}
            >
                {/* User location marker */}
                <Marker
                    coordinate={userLocation}
                    title="Ma position"
                    pinColor={colors.primary}
                />

                {/* Destination marker */}
                {destination && (
                    <Marker
                        coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
                        title={destination.address}
                    >
                        <View style={{ alignItems: 'center' }}>
                            <MapPin size={32} color="#EF4444" weight="fill" />
                        </View>
                    </Marker>
                )}

                {/* Route polyline - UPS premium double stroke style */}
                {routeCoordinates.length > 0 && (
                    <>
                        {/* Outer stroke - dark brown border */}
                        <Polyline
                            coordinates={routeCoordinates}
                            strokeColors={["#1a0f0a"]}
                            strokeWidth={10}
                            lineCap="round"
                            lineJoin="round"
                            geodesic={true}
                            zIndex={9}
                        />
                        {/* Inner stroke - UPS gold */}
                        <Polyline
                            coordinates={routeCoordinates}
                            strokeColors={["#FFB500"]}
                            strokeWidth={6}
                            lineCap="round"
                            lineJoin="round"
                            geodesic={true}
                            zIndex={10}
                        />
                    </>
                )}
            </MapView>

            {/* Select from map indicator */}
            {selectingFromMap && (
                <View style={{
                    position: 'absolute',
                    top: Platform.OS === 'ios' ? 120 : 100,
                    left: 16,
                    right: 16,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    padding: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 5,
                }}>
                    <Crosshair size={18} color="#351C15" weight="fill" />
                    <Text style={{ color: '#351C15', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                        Appuyez sur la carte pour sélectionner
                    </Text>
                </View>
            )}

            {/* Search Bar - Hidden during navigation */}
            {!isNavigating && (
                <View style={{
                    position: 'absolute',
                    top: Platform.OS === 'ios' ? 60 : 40,
                    left: 16,
                    right: 16,
                    zIndex: 10,
                }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        height: 50,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 4,
                        elevation: 3,
                    }}>
                        <MagnifyingGlass size={20} color={colors.textSecondary} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setShowHistory(text.length === 0);
                            }}
                            onFocus={() => {
                                if (searchQuery.length === 0 && searchHistory.length > 0) {
                                    setShowHistory(true);
                                }
                            }}
                            onBlur={() => setShowHistory(false)}
                            placeholder="Tapez une adresse..."
                            placeholderTextColor={colors.textSecondary}
                            style={{
                                flex: 1,
                                marginLeft: 10,
                                color: colors.textPrimary,
                                fontSize: 16,
                                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                            }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={clearRoute} style={{ padding: 6 }}>
                                <X size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={{ padding: 6 }}>
                            <Camera size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 6 }}>
                            <Microphone size={22} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectingFromMap(!selectingFromMap);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            }}
                            style={{ padding: 6 }}
                        >
                            <Crosshair size={22} color={selectingFromMap ? colors.primary : colors.textPrimary} weight={selectingFromMap ? 'fill' : 'regular'} />
                        </TouchableOpacity>
                    </View>

                    {/* History dropdown - show when input focused and empty */}
                    {showHistory && searchHistory.length > 0 && !destination && (
                        <View style={{
                            backgroundColor: colors.surface,
                            borderRadius: 12,
                            marginTop: 8,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                        }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, padding: 12, paddingBottom: 4 }}>Recherches récentes</Text>
                            <ScrollView keyboardShouldPersistTaps="handled">
                                {searchHistory.map((item, index) => (
                                    <TouchableOpacity
                                        key={`${item.placeId}-${index}`}
                                        onPress={() => {
                                            setSearchQuery(item.address);
                                            setShowHistory(false);
                                        }}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 14,
                                            borderBottomWidth: index < searchHistory.length - 1 ? 1 : 0,
                                            borderBottomColor: colors.background,
                                        }}
                                    >
                                        <ClockCounterClockwise size={20} color={colors.textSecondary} />
                                        <Text style={{ color: colors.textPrimary, fontSize: 15, marginLeft: 12, flex: 1 }} numberOfLines={1}>
                                            {item.address}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Predictions dropdown - only show when no route selected */}
                    {showPredictions && predictions.length > 0 && !destination && !showHistory && (
                        <View style={{
                            backgroundColor: colors.surface,
                            borderRadius: 12,
                            marginTop: 8,
                            maxHeight: 300,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 3,
                        }}>
                            {predictionsLoading ? (
                                <View style={{ padding: 20, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={colors.primary} />
                                </View>
                            ) : (

                                <ScrollView keyboardShouldPersistTaps="handled">
                                    {predictions.slice(0, 5).map((prediction) => (
                                        <TouchableOpacity
                                            key={prediction.place_id}
                                            onPress={() => selectPrediction(prediction)}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                padding: 14,
                                                borderBottomWidth: 1,
                                                borderBottomColor: colors.background,
                                            }}
                                        >

                                            <MapPin size={20} color={colors.textSecondary} />

                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '500' }}>
                                                    {prediction.structured_formatting?.main_text || prediction.description}
                                                </Text>
                                                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                                                    {prediction.structured_formatting?.secondary_text || ''}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    )}
                </View>
            )}

            {/* Navigation UI - Shows during active navigation */}
            {isNavigating && navigationSteps[currentStepIndex] && (
                <>
                    {/* Top instruction banner */}
                    <View style={{
                        position: 'absolute',
                        top: Platform.OS === 'ios' ? 60 : 40,
                        left: 16,
                        right: 16,
                        backgroundColor: '#351C15',
                        borderRadius: 16,
                        padding: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                        zIndex: 20,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{
                                backgroundColor: colors.primary,
                                borderRadius: 12,
                                padding: 12,
                                marginRight: 12,
                            }}>
                                {getManeuverIcon(navigationSteps[currentStepIndex].maneuver)}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                                    {navigationSteps[currentStepIndex].distance}
                                </Text>
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>
                                    {navigationSteps[currentStepIndex].instruction}
                                </Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                Étape {currentStepIndex + 1} / {navigationSteps.length}
                            </Text>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                                {remainingInfo?.duration || routeInfo?.duration} restant
                            </Text>
                        </View>
                    </View>

                    {/* Bottom controls - Show remaining time/distance */}
                    <View style={{
                        position: 'absolute',
                        bottom: Platform.OS === 'ios' ? 100 : 80,
                        left: 16,
                        right: 16,
                        backgroundColor: colors.surface,
                        borderRadius: 16,
                        padding: 16,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 5,
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            {/* Remaining time and distance */}
                            <View style={{ flexDirection: 'row', flex: 1, gap: 12 }}>
                                <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 10, alignItems: 'center', flex: 1 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Temps restant</Text>
                                    <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>
                                        {remainingInfo?.duration || routeInfo?.duration}
                                    </Text>
                                </View>
                                <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 10, alignItems: 'center', flex: 1 }}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 10 }}>Distance</Text>
                                    <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
                                        {remainingInfo?.distance || routeInfo?.distance}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={stopNavigation}
                                style={{
                                    backgroundColor: '#EF4444',
                                    borderRadius: 12,
                                    padding: 12,
                                    marginLeft: 12,
                                }}
                            >
                                <XCircle size={24} color="#fff" weight="fill" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}

            {/* Route Info Card - Shows when not navigating */}
            {routeInfo && destination && !isNavigating && (
                <View style={{
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 100 : 80,
                    left: 16,
                    right: 16,
                    backgroundColor: colors.surface,
                    borderRadius: 16,
                    padding: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 8,
                    elevation: 5,
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Destination</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                                {destination.address}
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
                        <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Distance</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 2 }}>
                                {routeInfo.distance}
                            </Text>
                        </View>
                        <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 10, padding: 12, alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Durée</Text>
                            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 2 }}>
                                {routeInfo.duration}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={startNavigation}
                        style={{
                            backgroundColor: colors.primary,
                            borderRadius: 12,
                            padding: 14,
                            marginTop: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <NavigationArrow size={20} color="#351C15" weight="fill" />
                        <Text style={{ color: '#351C15', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                            Démarrer
                        </Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
