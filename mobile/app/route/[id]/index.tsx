import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, TextInput, Modal, Platform, Dimensions, Keyboard, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { routesApi, stopsApi, servicesApi } from '../../../src/services/api';
import { Route, Stop, StopType, StopPriority, PlacePrediction } from '../../../src/types';
import { ArrowLeft, House, Flag, Coffee, MagnifyingGlass, MapPin, Camera, Microphone, X, DotsThreeVertical, NavigationArrow, Plus, Sparkle, Play } from 'phosphor-react-native';
import { AddStopBottomSheet, AddStopBottomSheetRef, StopPayload } from '../../../src/components/AddStopBottomSheet';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Haptics from 'expo-haptics';

export default function RouteDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const routeId = useMemo(() => (Array.isArray(id) ? id[0] : id), [id]);

    const { colors } = useTheme();
    const router = useRouter();

    const [route, setRoute] = useState<Route | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [optimizing, setOptimizing] = useState(false);

    const addStopSheetRef = useRef<AddStopBottomSheetRef>(null);

    const [editingStop, setEditingStop] = useState<Stop | null>(null);

    // Address search overlay state
    const [searchOverlayVisible, setSearchOverlayVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchPredictions, setSearchPredictions] = useState<PlacePrediction[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const mapRef = useRef<MapView>(null);

    // Route configuration
    const [startPoint, setStartPoint] = useState<{ address: string; lat: number; lng: number } | null>(null);
    const [endPoint, setEndPoint] = useState<{ address: string; lat: number; lng: number } | null>(null);

    // Overlay expanded state
    const [overlayExpanded, setOverlayExpanded] = useState(true);

    // Keyboard state
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const load = useCallback(async () => {
        if (!routeId) return;
        try {
            const data = await routesApi.getById(routeId);
            setRoute(data);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? 'Impossible de charger la tournée');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [routeId]);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = () => {
        setRefreshing(true);
        load();
    };

    const handleOptimize = async () => {
        if (!routeId) return;
        setOptimizing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await routesApi.optimize(routeId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Navigate to optimized view
            router.push(`/route/${routeId}/optimized`);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible d'optimiser la tournée");
        } finally {
            setOptimizing(false);
        }
    };

    const handleContinueRoute = () => {
        if (!routeId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push(`/route/${routeId}/execute`);
    };

    const handleViewOptimized = () => {
        if (!routeId) return;
        router.push(`/route/${routeId}/optimized`);
    };

    const handleDuplicateStop = async () => {
        if (!routeId || !editingStop) return;

        try {
            await stopsApi.create(routeId, {
                address: editingStop.address,
                latitude: editingStop.latitude,
                longitude: editingStop.longitude,
                notes: editingStop.notes || undefined,
                type: editingStop.type || StopType.DELIVERY,
                estimated_duration_seconds: editingStop.estimated_duration_seconds || 180,
                package_count: editingStop.package_count || 1,
                first_name: editingStop.first_name || undefined,
                last_name: editingStop.last_name || undefined,
                phone_number: editingStop.phone_number || undefined,
            } as any);

            addStopSheetRef.current?.close();
            setEditingStop(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await load();
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible de dupliquer l'arrêt");
        }
    };

    const handleDeleteStop = async () => {
        if (!routeId || !editingStop) return;

        try {
            await stopsApi.delete(routeId, editingStop.id);
            addStopSheetRef.current?.close();
            setEditingStop(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await load();
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible de supprimer l'arrêt");
        }
    };

    const stops: Stop[] = route?.stops ?? [];

    const openAddStop = () => {
        setEditingStop(null);
        addStopSheetRef.current?.present();
    };

    const openEditStop = (stop: Stop) => {
        setEditingStop(stop);
        addStopSheetRef.current?.present();
    };

    const handleUpdateStop = async (payload: StopPayload) => {
        if (!routeId || !editingStop) return;

        const estimatedDurationSeconds = Math.max(0, Math.round(payload.durationMinutes * 60));
        const packageCount = Math.max(0, Math.round(payload.packageCount));

        await stopsApi.update(routeId, editingStop.id, {
            address: payload.address,
            city: payload.city || undefined,
            postal_code: payload.postalCode || undefined,
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            priority: payload.priority,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            first_name: payload.fullName || undefined,
            phone_number: payload.phoneNumber || undefined,
            time_window_start: payload.timeWindowStart || undefined,
            time_window_end: payload.timeWindowEnd || undefined,
        } as any);

        addStopSheetRef.current?.close();
        setEditingStop(null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await load();
    };

    const handleAddStopSubmit = async (payload: StopPayload): Promise<string | void> => {
        if (!routeId) return;

        const estimatedDurationSeconds = Math.max(0, Math.round(payload.durationMinutes * 60));
        const packageCount = Math.max(0, Math.round(payload.packageCount));
        const sequenceOrder = payload.order === 'first' ? 0 : payload.order === 'last' ? 9999 : undefined;

        const newStop = await stopsApi.create(routeId, {
            address: payload.address,
            city: payload.city || undefined,
            postal_code: payload.postalCode || undefined,
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            priority: payload.priority,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            sequence_order: sequenceOrder,
            first_name: payload.fullName || undefined,
            phone_number: payload.phoneNumber || undefined,
            time_window_start: payload.timeWindowStart || undefined,
            time_window_end: payload.timeWindowEnd || undefined,
        } as any);

        // In auto-add mode, don't close sheet - return the stop ID
        if (newStop?.id) {
            await load();
            return newStop.id;
        }

        addStopSheetRef.current?.close();
        await load();
    };

    // Update stop by ID (for auto-add mode)
    const handleUpdateStopById = async (stopId: string, payload: StopPayload) => {
        if (!routeId) return;

        const estimatedDurationSeconds = Math.max(0, Math.round(payload.durationMinutes * 60));
        const packageCount = Math.max(0, Math.round(payload.packageCount));

        await stopsApi.update(routeId, stopId, {
            address: payload.address,
            city: payload.city || undefined,
            postal_code: payload.postalCode || undefined,
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            priority: payload.priority,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            first_name: payload.fullName || undefined,
            phone_number: payload.phoneNumber || undefined,
            time_window_start: payload.timeWindowStart || undefined,
            time_window_end: payload.timeWindowEnd || undefined,
        } as any);

        await load();
    };

    // Reopen scanner after dismissing the sheet
    const handleDismissAfterScan = useCallback(() => {
        // Small delay to let the sheet close, then reopen with scanner
        setTimeout(() => {
            addStopSheetRef.current?.presentWithScanner();
        }, 300);
    }, []);

    // Search autocomplete effect
    useEffect(() => {
        const q = searchQuery.trim();
        if (q.length < 3) {
            setSearchPredictions([]);
            return;
        }

        setSearchLoading(true);
        const timeout = setTimeout(async () => {
            try {
                const results = await servicesApi.autocomplete(q);
                setSearchPredictions(results);
            } catch {
                setSearchPredictions([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    // Select prediction from search overlay
    const selectSearchPrediction = useCallback(async (prediction: PlacePrediction) => {
        try {
            const details = await servicesApi.getPlaceDetails(prediction.place_id);
            if (details?.latitude && details?.longitude) {
                // Open AddStopBottomSheet with the selected address
                setSearchOverlayVisible(false);
                setSearchQuery('');
                setSearchPredictions([]);

                // Set editing stop to null to add new stop
                setEditingStop(null);

                // Present the sheet and it will be populated via props
                setTimeout(() => {
                    addStopSheetRef.current?.present();
                }, 100);

                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
        } catch (e) {
            console.error('[Search] Failed to get place details:', e);
        }
    }, []);

    // Open scanner from search overlay
    const handleSearchScan = useCallback(() => {
        setSearchOverlayVisible(false);
        setSearchQuery('');
        setTimeout(() => {
            addStopSheetRef.current?.presentWithScanner();
        }, 100);
    }, []);

    // Calculate map region based on stops
    const mapRegion = useMemo(() => {
        if (stops.length === 0) {
            return {
                latitude: 45.75,
                longitude: 4.85,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
            };
        }

        const lats = stops.map(s => s.latitude);
        const lngs = stops.map(s => s.longitude);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
            longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
        };
    }, [stops]);

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

    const screenHeight = Dimensions.get('window').height;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Map Background */}
            <MapView
                ref={mapRef}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: overlayExpanded ? screenHeight * 0.35 : screenHeight * 0.6 }}
                provider={PROVIDER_GOOGLE}
                region={mapRegion}
                showsUserLocation
                showsMyLocationButton={false}
            >
                {stops.map((stop, index) => (
                    <Marker
                        key={stop.id}
                        coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
                        title={stop.address}
                        description={`#${index + 1}`}
                    />
                ))}
            </MapView>

            {/* Main Overlay */}
            <View style={{
                flex: 1,
                marginTop: overlayExpanded ? screenHeight * 0.12 : screenHeight * 0.55,
                backgroundColor: colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
            }}>
                {/* Drag Handle */}
                <TouchableOpacity
                    onPress={() => setOverlayExpanded(!overlayExpanded)}
                    style={{ alignItems: 'center', paddingVertical: 12 }}
                >
                    <View style={{ width: 40, height: 4, backgroundColor: colors.textSecondary, borderRadius: 2, opacity: 0.5 }} />
                </TouchableOpacity>
                {/* Search Input Header */}
                <TouchableOpacity
                    onPress={() => setSearchOverlayVisible(true)}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.background,
                        marginHorizontal: 16,
                        marginTop: 16,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        height: 48,
                    }}
                >
                    <MagnifyingGlass size={18} color={colors.textSecondary} />
                    <Text style={{ flex: 1, marginLeft: 10, color: colors.textSecondary, fontSize: 14 }}>
                        Ajouter d'autres arrêts...
                    </Text>
                    <TouchableOpacity onPress={handleSearchScan} style={{ padding: 8 }}>
                        <Camera size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ padding: 8 }}>
                        <Microphone size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={{ padding: 8 }}>
                        <DotsThreeVertical size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                </TouchableOpacity>

                {/* Stop count + Route name */}
                <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        {stops.length} arrêt{stops.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={{ fontSize: 24, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                        {route.name}
                    </Text>
                </View>

                <ScrollView
                    style={{ flex: 1, marginTop: 16 }}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                >
                    {/* Configuration du trajet */}
                    <View style={{ paddingHorizontal: 16 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Configuration du trajet
                        </Text>

                        {/* Point de départ */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.background,
                            }}
                        >
                            <Text style={{ fontSize: 14, color: colors.textSecondary, width: 50 }}>
                                {startPoint ? '11:00' : ''}
                            </Text>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                                    {startPoint?.address || 'Point de départ'}
                                </Text>
                                {startPoint && (
                                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                        {startPoint.address}
                                    </Text>
                                )}
                            </View>
                            <House size={22} color={colors.primary} weight="fill" />
                        </TouchableOpacity>

                        {/* Point d'arrivée */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.background,
                            }}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textSecondary, marginLeft: 21 }} />
                            <View style={{ flex: 1, marginLeft: 29 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                                    {endPoint?.address || 'Terminer à...'}
                                </Text>
                                {endPoint && (
                                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                        {endPoint.address}
                                    </Text>
                                )}
                            </View>
                            <Flag size={22} color={colors.primary} />
                        </TouchableOpacity>

                        {/* Pause */}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 14,
                                borderBottomWidth: 1,
                                borderBottomColor: colors.background,
                            }}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textSecondary, marginLeft: 21 }} />
                            <View style={{ flex: 1, marginLeft: 29 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                                    Aucune pause définie
                                </Text>
                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                    Définir une pause par défaut
                                </Text>
                            </View>
                            <Coffee size={22} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Arrêts section */}
                    <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Arrêts
                        </Text>

                        {stops.length === 0 ? (
                            <View style={{ backgroundColor: colors.background, padding: 16, borderRadius: 12 }}>
                                <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                                    Aucun arrêt pour le moment
                                </Text>
                            </View>
                        ) : (
                            stops
                                .slice()
                                .sort((a, b) => (a.sequence_order ?? 9999) - (b.sequence_order ?? 9999))
                                .map((stop, index) => (
                                    <TouchableOpacity
                                        key={stop.id}
                                        onPress={() => openEditStop(stop)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingVertical: 14,
                                            borderBottomWidth: 1,
                                            borderBottomColor: colors.background,
                                        }}
                                    >
                                        <Text style={{ fontSize: 14, color: colors.textSecondary, width: 30, textAlign: 'center' }}>
                                            {String(index + 1).padStart(2, '0')}
                                        </Text>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
                                                {stop.address.split(',')[0]}
                                            </Text>
                                            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                                                {stop.city || stop.address.split(',').slice(1).join(',').trim()}
                                            </Text>
                                        </View>
                                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary }} />
                                    </TouchableOpacity>
                                ))
                        )}
                    </View>
                </ScrollView>

                {/* Bottom Optimize Button */}
                <View style={{ padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16 }}>
                    <TouchableOpacity
                        onPress={handleOptimize}
                        disabled={optimizing || route.status === 'in_progress' || route.status === 'completed' || stops.length === 0}
                        style={{
                            backgroundColor: colors.primary,
                            padding: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            opacity: (optimizing || route.status === 'in_progress' || route.status === 'completed' || stops.length === 0) ? 0.5 : 1,
                        }}
                    >
                        <Sparkle size={20} color="#351C15" weight="fill" />
                        <Text style={{ color: '#351C15', fontSize: 16, fontWeight: '700', marginLeft: 10 }}>
                            {optimizing ? 'Optimisation...' : 'Optimiser le trajet'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Address Overlay (Photo 3 style) */}
            <Modal
                visible={searchOverlayVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setSearchOverlayVisible(false)}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: colors.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Search Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surface,
                        marginTop: Platform.OS === 'ios' ? 50 : 20,
                        marginHorizontal: 16,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        height: 48,
                    }}>
                        <MagnifyingGlass size={18} color={colors.textSecondary} />
                        <TextInput
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Saisissez du texte pour ajouter..."
                            placeholderTextColor={colors.textSecondary}
                            autoFocus
                            keyboardType="default"
                            returnKeyType="search"
                            style={{
                                flex: 1,
                                marginLeft: 10,
                                color: colors.textPrimary,
                                fontSize: 14,
                                paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                            }}
                        />
                        <TouchableOpacity onPress={handleSearchScan} style={{ padding: 8 }}>
                            <Camera size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 8 }}>
                            <Microphone size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSearchOverlayVisible(false)} style={{ padding: 8 }}>
                            <X size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    {/* Predictions or Empty State */}
                    <ScrollView style={{ flex: 1, marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
                        {searchLoading && (
                            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={colors.primary} />
                            </View>
                        )}

                        {!searchLoading && searchPredictions.length === 0 && searchQuery.length < 3 && (
                            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 }}>
                                <View style={{ width: 60, height: 60, borderWidth: 2, borderColor: colors.textSecondary, borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <Plus size={24} color={colors.textSecondary} />
                                </View>
                                <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>
                                    Ajoutez des arrêts ou trouvez des arrêts sur ce trajet
                                </Text>
                            </View>
                        )}

                        {searchPredictions.length > 0 && (
                            <View style={{ backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' }}>
                                {searchPredictions.slice(0, 5).map((p) => (
                                    <TouchableOpacity
                                        key={p.place_id}
                                        onPress={() => selectSearchPrediction(p)}
                                        style={{
                                            paddingVertical: 14,
                                            paddingHorizontal: 16,
                                            borderBottomWidth: 1,
                                            borderBottomColor: colors.background,
                                        }}
                                    >
                                        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>
                                            {p.structured_formatting?.main_text ?? p.description}
                                        </Text>
                                        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                                            {p.structured_formatting?.secondary_text ?? ''}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>

                    {/* Bottom Action Buttons (Carte, Scanner, Voix) */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 16,
                        padding: 16,
                        paddingBottom: Platform.OS === 'ios' ? 34 : 16,
                    }}>
                        <TouchableOpacity
                            style={{
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                paddingVertical: 16,
                                paddingHorizontal: 24,
                                minWidth: 90,
                            }}
                        >
                            <MapPin size={24} color={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontSize: 12, marginTop: 8 }}>Carte</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSearchScan}
                            style={{
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                paddingVertical: 16,
                                paddingHorizontal: 24,
                                minWidth: 90,
                            }}
                        >
                            <Camera size={24} color={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontSize: 12, marginTop: 8 }}>Scanner</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                paddingVertical: 16,
                                paddingHorizontal: 24,
                                minWidth: 90,
                            }}
                        >
                            <Microphone size={24} color={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontSize: 12, marginTop: 8 }}>Voix</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <AddStopBottomSheet
                ref={addStopSheetRef}
                title={editingStop ? 'Modifier l\'arrêt' : 'Ajouter un stop'}
                initialAddress={editingStop?.address || ''}
                initialCity={editingStop?.city || ''}
                initialPostalCode={editingStop?.postal_code || ''}
                initialLatitude={editingStop?.latitude || 0}
                initialLongitude={editingStop?.longitude || 0}
                initialNotes={editingStop?.notes || ''}
                initialPackageCount={editingStop?.package_count || 1}
                initialDurationMinutes={editingStop ? Math.round(editingStop.estimated_duration_seconds / 60) : 3}
                initialType={editingStop?.type || StopType.DELIVERY}
                initialPriority={editingStop?.priority || StopPriority.NORMAL}
                initialFullName={[editingStop?.first_name, editingStop?.last_name].filter(Boolean).join(' ') || ''}
                initialPhoneNumber={editingStop?.phone_number || ''}
                initialTimeWindowStart={editingStop?.time_window_start || ''}
                initialTimeWindowEnd={editingStop?.time_window_end || ''}
                showActions={!!editingStop}
                autoAddOnScan={!editingStop}
                existingStops={stops.map(s => ({ address: s.address, latitude: s.latitude, longitude: s.longitude, order: undefined }))}
                onPressAdd={editingStop ? handleUpdateStop : handleAddStopSubmit}
                onUpdateStop={handleUpdateStopById}
                onPressDuplicateStop={handleDuplicateStop}
                onPressDeleteStop={handleDeleteStop}
                onDismissAfterScan={handleDismissAfterScan}
            />
        </View>
    );
}
