import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { routesApi, stopsApi } from '../../../src/services/api';
import { Route, Stop, StopType, StopPriority } from '../../../src/types';
import { ArrowLeft, Plus, Sparkle, Play } from 'phosphor-react-native';
import { AddStopBottomSheet, AddStopBottomSheetRef, StopPayload } from '../../../src/components/AddStopBottomSheet';
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
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            priority: payload.priority,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            first_name: payload.firstName || undefined,
            last_name: payload.lastName || undefined,
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
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            priority: payload.priority,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            sequence_order: sequenceOrder,
            first_name: payload.firstName || undefined,
            last_name: payload.lastName || undefined,
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
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            priority: payload.priority,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            first_name: payload.firstName || undefined,
            last_name: payload.lastName || undefined,
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

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ padding: 24, paddingTop: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ flex: 1, marginLeft: 8, fontSize: 18, fontWeight: '700', color: colors.textPrimary }} numberOfLines={1}>
                    {route.name}
                </Text>
                <View style={{ width: 32 }} />
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            >
                <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 16 }}>
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>Statut</Text>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4 }}>
                        {route.status === 'draft' && 'Brouillon'}
                        {route.status === 'optimized' && 'Optimisé'}
                        {route.status === 'in_progress' && 'En cours'}
                        {route.status === 'completed' && 'Terminé'}
                    </Text>

                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Distance</Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 2 }}>
                                {route.total_distance_meters ? `${(route.total_distance_meters / 1000).toFixed(1)} km` : '—'}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Durée</Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 2 }}>
                                {route.total_duration_seconds
                                    ? `${Math.round(route.total_duration_seconds / 60)} min`
                                    : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Continue button for in_progress routes */}
                {route.status === 'in_progress' && (
                    <TouchableOpacity
                        onPress={handleContinueRoute}
                        style={{
                            backgroundColor: '#22C55E',
                            padding: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <Play size={22} color="#FFFFFF" weight="fill" />
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 10 }}>
                            CONTINUER LA TOURNÉE
                        </Text>
                    </TouchableOpacity>
                )}

                {/* View optimized route button */}
                {route.status === 'optimized' && (
                    <TouchableOpacity
                        onPress={handleViewOptimized}
                        style={{
                            backgroundColor: '#22C55E',
                            padding: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <Play size={22} color="#FFFFFF" weight="fill" />
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 10 }}>
                            DÉMARRER LA TOURNÉE
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <TouchableOpacity
                        onPress={handleOptimize}
                        disabled={optimizing || route.status === 'in_progress' || route.status === 'completed'}
                        style={{
                            flex: 1,
                            backgroundColor: colors.primary,
                            padding: 14,
                            borderRadius: 12,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            opacity: (optimizing || route.status === 'in_progress' || route.status === 'completed') ? 0.5 : 1,
                        }}
                    >
                        <Sparkle size={18} color="#351C15" weight="fill" />
                        <Text style={{ color: '#351C15', fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
                            {optimizing ? 'Optimisation...' : 'Optimiser'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={openAddStop}
                        style={{
                            width: 52,
                            height: 52,
                            borderRadius: 12,
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Plus size={22} color={colors.textPrimary} weight="bold" />
                    </TouchableOpacity>
                </View>

                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
                    Stops ({stops.length})
                </Text>

                {stops.length === 0 ? (
                    <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12 }}>
                        <Text style={{ color: colors.textSecondary }}>
                            Aucun stop pour le moment. Ajoute des adresses pour pouvoir optimiser.
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
                                    backgroundColor: colors.surface,
                                    padding: 16,
                                    borderRadius: 12,
                                    marginBottom: 12,
                                }}
                            >
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                    #{stop.sequence_order ?? index + 1} • {stop.type} • {stop.package_count} colis • {Math.round(stop.estimated_duration_seconds / 60)} min
                                </Text>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginTop: 6 }}>
                                    {stop.address}
                                </Text>
                                {!!stop.notes && (
                                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }} numberOfLines={2}>
                                        {stop.notes}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ))
                )}
            </ScrollView>

            <AddStopBottomSheet
                ref={addStopSheetRef}
                title={editingStop ? 'Modifier l\'arrêt' : 'Ajouter un stop'}
                initialAddress={editingStop?.address || ''}
                initialLatitude={editingStop?.latitude || 0}
                initialLongitude={editingStop?.longitude || 0}
                initialNotes={editingStop?.notes || ''}
                initialPackageCount={editingStop?.package_count || 1}
                initialDurationMinutes={editingStop ? Math.round(editingStop.estimated_duration_seconds / 60) : 3}
                initialType={editingStop?.type || StopType.DELIVERY}
                initialPriority={editingStop?.priority || StopPriority.NORMAL}
                initialFirstName={editingStop?.first_name || ''}
                initialLastName={editingStop?.last_name || ''}
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
