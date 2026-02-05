import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { routesApi } from '../../../src/services/api';
import { Route, Stop, RouteStatus } from '../../../src/types';
import { ArrowLeft, Play, ArrowsClockwise, MapPin, Clock, Path } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OptimizedRouteScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const routeId = Array.isArray(id) ? id[0] : id;

    const { colors } = useTheme();
    const router = useRouter();

    const [route, setRoute] = useState<Route | null>(null);
    const [loading, setLoading] = useState(true);
    const [reoptimizing, setReoptimizing] = useState(false);
    const [starting, setStarting] = useState(false);

    const mapRef = useRef<MapView>(null);

    const load = useCallback(async () => {
        if (!routeId) return;
        try {
            const data = await routesApi.getById(routeId);
            setRoute(data);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? 'Impossible de charger la tournée');
        } finally {
            setLoading(false);
        }
    }, [routeId]);

    useEffect(() => {
        load();
    }, [load]);

    const stops: Stop[] = route?.stops?.slice().sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0)) ?? [];

    // Fit map to show all stops
    useEffect(() => {
        if (stops.length > 0 && mapRef.current) {
            const coordinates = stops.map(s => ({ latitude: s.latitude, longitude: s.longitude }));
            mapRef.current.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
            });
        }
    }, [stops]);

    const handleReoptimize = async () => {
        if (!routeId || reoptimizing) return;

        setReoptimizing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const updated = await routesApi.optimize(routeId);
            setRoute(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible de réoptimiser");
        } finally {
            setReoptimizing(false);
        }
    };

    const handleStartRoute = async () => {
        if (!routeId || starting) return;

        setStarting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        try {
            // Update route status to in_progress
            await routesApi.update(routeId, { status: RouteStatus.IN_PROGRESS });
            
            // Navigate to execution screen
            router.replace(`/route/${routeId}/execute`);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible de démarrer la tournée");
            setStarting(false);
        }
    };

    // Calculate stats
    const totalDistance = route?.total_distance_meters ? (route.total_distance_meters / 1000).toFixed(1) : '—';
    const totalDuration = route?.total_duration_seconds ? Math.round(route.total_duration_seconds / 60) : null;
    const durationHours = totalDuration ? Math.floor(totalDuration / 60) : 0;
    const durationMins = totalDuration ? totalDuration % 60 : 0;
    const durationText = totalDuration ? `${durationHours}h${durationMins.toString().padStart(2, '0')}` : '—';

    // Estimated times
    const now = new Date();
    const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const endDate = totalDuration ? new Date(now.getTime() + totalDuration * 60000) : null;
    const endTime = endDate ? `~${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}` : '—';

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!route) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
                    Tournée introuvable
                </Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Polyline coordinates
    const polylineCoords = stops.map(s => ({ latitude: s.latitude, longitude: s.longitude }));

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                zIndex: 10,
                paddingTop: 50,
                paddingHorizontal: 16,
                paddingBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: colors.background,
            }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                    Itinéraire
                </Text>
                <TouchableOpacity 
                    onPress={handleReoptimize} 
                    disabled={reoptimizing}
                    style={{ padding: 8, opacity: reoptimizing ? 0.5 : 1 }}
                >
                    <ArrowsClockwise size={24} color={colors.primary} weight={reoptimizing ? 'regular' : 'bold'} />
                </TouchableOpacity>
            </View>

            {/* Map */}
            <View style={{ height: SCREEN_HEIGHT * 0.35, marginTop: 100 }}>
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    initialRegion={{
                        latitude: stops[0]?.latitude ?? 45.75,
                        longitude: stops[0]?.longitude ?? 4.85,
                        latitudeDelta: 0.1,
                        longitudeDelta: 0.1,
                    }}
                >
                    {/* Route polyline */}
                    {polylineCoords.length > 1 && (
                        <Polyline
                            coordinates={polylineCoords}
                            strokeColor={colors.primary}
                            strokeWidth={4}
                        />
                    )}

                    {/* Stop markers */}
                    {stops.map((stop, index) => (
                        <Marker
                            key={stop.id}
                            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                            title={`${index + 1}. ${stop.address}`}
                        >
                            <View style={{ 
                                backgroundColor: colors.primary, 
                                width: 28, 
                                height: 28, 
                                borderRadius: 14,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 2,
                                borderColor: '#FFFFFF',
                            }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                                    {index + 1}
                                </Text>
                            </View>
                        </Marker>
                    ))}
                </MapView>
            </View>

            {/* Stats banner */}
            <View style={{ 
                flexDirection: 'row', 
                backgroundColor: colors.surface, 
                paddingVertical: 16,
                paddingHorizontal: 20,
                justifyContent: 'space-around',
            }}>
                <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MapPin size={18} color={colors.primary} weight="fill" />
                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginLeft: 6 }}>
                            {stops.length}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>stops</Text>
                </View>

                <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Path size={18} color={colors.primary} weight="fill" />
                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginLeft: 6 }}>
                            {totalDistance}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>km</Text>
                </View>

                <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Clock size={18} color={colors.primary} weight="fill" />
                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginLeft: 6 }}>
                            {durationText}
                        </Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>durée</Text>
                </View>
            </View>

            {/* Time estimate */}
            <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.background }}>
                <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                    🕐 {startTime} → {endTime}
                </Text>
            </View>

            {/* Stops list */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                {stops.map((stop, index) => {
                    // Estimate arrival time for each stop
                    const stopDurationBefore = stops.slice(0, index).reduce((acc, s) => acc + (s.estimated_duration_seconds || 180), 0);
                    const travelTimeBefore = index > 0 ? index * 5 * 60 : 0; // Rough estimate: 5 min between stops
                    const arrivalOffset = (stopDurationBefore + travelTimeBefore) / 60;
                    const arrivalDate = new Date(now.getTime() + arrivalOffset * 60000);
                    const arrivalTime = `${arrivalDate.getHours().toString().padStart(2, '0')}:${arrivalDate.getMinutes().toString().padStart(2, '0')}`;

                    return (
                        <View
                            key={stop.id}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                                marginBottom: 16,
                            }}
                        >
                            {/* Number indicator */}
                            <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: colors.primary,
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginRight: 12,
                            }}>
                                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                                    {index + 1}
                                </Text>
                            </View>

                            {/* Stop info */}
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }} numberOfLines={2}>
                                    {stop.address}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                                        📦 {stop.package_count} • ⏱️ {Math.round(stop.estimated_duration_seconds / 60)}min
                                    </Text>
                                </View>
                            </View>

                            {/* Arrival time */}
                            <Text style={{ fontSize: 13, color: colors.textSecondary, marginLeft: 8 }}>
                                {arrivalTime}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>

            {/* Start button */}
            <View style={{ padding: 16, paddingBottom: 32, backgroundColor: colors.background }}>
                <TouchableOpacity
                    onPress={handleStartRoute}
                    disabled={starting || stops.length === 0}
                    style={{
                        backgroundColor: '#22C55E',
                        paddingVertical: 18,
                        borderRadius: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: (starting || stops.length === 0) ? 0.7 : 1,
                    }}
                >
                    <Play size={24} color="#FFFFFF" weight="fill" />
                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginLeft: 10 }}>
                        {starting ? 'DÉMARRAGE...' : 'DÉMARRER TOURNÉE'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
