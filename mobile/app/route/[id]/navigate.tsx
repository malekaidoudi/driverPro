import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { routesApi } from '../../../src/services/api';
import { Route, Stop, StopStatus } from '../../../src/types';
import { ArrowLeft, NavigationArrow, MapPin, ArrowRight, ArrowUpRight, ArrowUpLeft, ArrowUp, X } from 'phosphor-react-native';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Camera } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import Constants from 'expo-constants';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

interface NavigationStep {
    instruction: string;
    distance: string;
    maneuver?: string;
}

export default function NavigateScreen() {
    const { id, stopIndex } = useLocalSearchParams<{ id: string; stopIndex?: string }>();
    const routeId = Array.isArray(id) ? id[0] : id;
    const initialStopIndex = stopIndex ? parseInt(Array.isArray(stopIndex) ? stopIndex[0] : stopIndex, 10) : 0;

    const { colors } = useTheme();
    const router = useRouter();
    const mapRef = useRef<MapView>(null);

    const [route, setRoute] = useState<Route | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [currentStopIndex, setCurrentStopIndex] = useState(initialStopIndex);
    const [navigationStep, setNavigationStep] = useState<NavigationStep>({
        instruction: 'Calcul de l\'itinéraire...',
        distance: '',
    });
    const [eta, setEta] = useState<string>('');
    const [remainingDistance, setRemainingDistance] = useState<string>('');

    // Load route data
    const load = useCallback(async () => {
        if (!routeId) return;
        try {
            const data = await routesApi.getById(routeId);
            setRoute(data);
            
            // Find first pending stop if no index provided
            if (!stopIndex) {
                const pendingIndex = data.stops?.findIndex(s => s.status === StopStatus.PENDING) ?? 0;
                setCurrentStopIndex(Math.max(0, pendingIndex));
            }
        } catch (error) {
            console.error('Failed to load route:', error);
        } finally {
            setLoading(false);
        }
    }, [routeId, stopIndex]);

    useEffect(() => {
        load();
    }, [load]);

    // Start location tracking
    useEffect(() => {
        let locationSubscription: Location.LocationSubscription | null = null;

        const startTracking = async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.warn('Location permission denied');
                return;
            }

            // Get initial location
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setCurrentLocation({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            // Subscribe to location updates
            locationSubscription = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    distanceInterval: 10, // Update every 10 meters
                    timeInterval: 3000, // Or every 3 seconds
                },
                (location) => {
                    setCurrentLocation({
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    });
                }
            );
        };

        startTracking();

        return () => {
            if (locationSubscription) {
                locationSubscription.remove();
            }
        };
    }, []);

    const stops: Stop[] = route?.stops?.slice().sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)) ?? [];
    const currentStop = stops[currentStopIndex];

    // Update camera to follow user
    useEffect(() => {
        if (currentLocation && mapRef.current) {
            mapRef.current.animateCamera({
                center: currentLocation,
                pitch: 60,
                heading: 0,
                zoom: 17,
            }, { duration: 500 });
        }
    }, [currentLocation]);

    // Handle directions ready
    const handleDirectionsReady = (result: any) => {
        if (result.legs && result.legs.length > 0) {
            const leg = result.legs[0];
            
            // Update ETA
            const duration = leg.duration?.value || 0;
            const minutes = Math.round(duration / 60);
            setEta(`${minutes} min`);

            // Update distance
            const distance = leg.distance?.value || 0;
            if (distance >= 1000) {
                setRemainingDistance(`${(distance / 1000).toFixed(1)} km`);
            } else {
                setRemainingDistance(`${distance} m`);
            }

            // Get next instruction
            if (leg.steps && leg.steps.length > 0) {
                const nextStep = leg.steps[0];
                const stepDistance = nextStep.distance?.value || 0;
                const distanceText = stepDistance >= 1000 
                    ? `${(stepDistance / 1000).toFixed(1)} km` 
                    : `${stepDistance} m`;

                setNavigationStep({
                    instruction: nextStep.html_instructions?.replace(/<[^>]*>/g, '') || 'Continuez tout droit',
                    distance: distanceText,
                    maneuver: nextStep.maneuver,
                });
            }
        }
    };

    // Get maneuver icon
    const getManeuverIcon = (maneuver?: string) => {
        switch (maneuver) {
            case 'turn-right':
            case 'turn-slight-right':
                return <ArrowRight size={32} color="#FFFFFF" weight="bold" />;
            case 'turn-left':
            case 'turn-slight-left':
                return <ArrowUpLeft size={32} color="#FFFFFF" weight="bold" />;
            case 'turn-sharp-right':
                return <ArrowUpRight size={32} color="#FFFFFF" weight="bold" />;
            case 'turn-sharp-left':
                return <ArrowUpLeft size={32} color="#FFFFFF" weight="bold" />;
            default:
                return <ArrowUp size={32} color="#FFFFFF" weight="bold" />;
        }
    };

    const handleClose = () => {
        router.back();
    };

    if (loading || !currentStop) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Chargement de la navigation...</Text>
            </View>
        );
    }

    const destination = { latitude: currentStop.latitude, longitude: currentStop.longitude };
    const origin = currentLocation || destination;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Full screen map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={{
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation
                showsMyLocationButton={false}
                followsUserLocation
                showsCompass={false}
                pitchEnabled
                rotateEnabled
            >
                {/* Destination marker */}
                <Marker coordinate={destination}>
                    <View style={{ 
                        backgroundColor: '#EF4444', 
                        padding: 8, 
                        borderRadius: 20,
                        borderWidth: 3,
                        borderColor: '#FFFFFF',
                    }}>
                        <MapPin size={24} color="#FFFFFF" weight="fill" />
                    </View>
                </Marker>

                {/* Directions */}
                {currentLocation && GOOGLE_MAPS_API_KEY && (
                    <MapViewDirections
                        origin={origin}
                        destination={destination}
                        apikey={GOOGLE_MAPS_API_KEY}
                        strokeWidth={6}
                        strokeColor={colors.primary}
                        onReady={handleDirectionsReady}
                        mode="DRIVING"
                        language="fr"
                    />
                )}
            </MapView>

            {/* Close button */}
            <TouchableOpacity
                onPress={handleClose}
                style={{
                    position: 'absolute',
                    top: 50,
                    left: 16,
                    backgroundColor: colors.surface,
                    padding: 12,
                    borderRadius: 12,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                    elevation: 4,
                }}
            >
                <X size={24} color={colors.textPrimary} weight="bold" />
            </TouchableOpacity>

            {/* Navigation instruction banner */}
            <View style={{
                position: 'absolute',
                top: 50,
                left: 80,
                right: 16,
                backgroundColor: colors.primary,
                borderRadius: 12,
                padding: 16,
                flexDirection: 'row',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 4,
            }}>
                {/* Maneuver icon */}
                <View style={{ marginRight: 12 }}>
                    {getManeuverIcon(navigationStep.maneuver)}
                </View>

                {/* Instruction text */}
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 14, opacity: 0.8 }}>
                        {navigationStep.distance}
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }} numberOfLines={2}>
                        {navigationStep.instruction}
                    </Text>
                </View>
            </View>

            {/* Bottom info card */}
            <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                padding: 20,
                paddingBottom: Platform.OS === 'ios' ? 34 : 20,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 8,
            }}>
                {/* ETA and distance */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.primary }}>
                            {eta || '—'}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Arrivée</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: colors.background, marginHorizontal: 16 }} />
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.textPrimary }}>
                            {remainingDistance || '—'}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Distance</Text>
                    </View>
                </View>

                {/* Destination */}
                <View style={{ 
                    backgroundColor: colors.background, 
                    padding: 16, 
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <View style={{ 
                        backgroundColor: '#EF4444', 
                        width: 40, 
                        height: 40, 
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                    }}>
                        <MapPin size={20} color="#FFFFFF" weight="fill" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                            Destination #{currentStopIndex + 1}
                        </Text>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>
                            {currentStop.address}
                        </Text>
                    </View>
                </View>

                {/* Arrived button */}
                <TouchableOpacity
                    onPress={handleClose}
                    style={{
                        backgroundColor: '#22C55E',
                        paddingVertical: 16,
                        borderRadius: 12,
                        marginTop: 16,
                        alignItems: 'center',
                    }}
                >
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                        JE SUIS ARRIVÉ
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
