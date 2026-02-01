import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { routesApi, stopsApi } from '../services/api';
import { Route, Stop, StopType } from '../types';
import { ArrowLeft, Plus, Sparkle } from 'phosphor-react-native';
import { AddStopBottomSheet, AddStopBottomSheetRef, StopPayload } from '../components/AddStopBottomSheet';

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

    const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
    const [duplicatingStop, setDuplicatingStop] = useState(false);
    const [deletingStop, setDeletingStop] = useState(false);

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
        try {
            const updated = await routesApi.optimize(routeId);
            setRoute(updated);
            Alert.alert('Succès', 'La tournée a été optimisée');
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible d'optimiser la tournée");
        } finally {
            setOptimizing(false);
        }
    };

    const handleDuplicateStop = async () => {
        if (!routeId) return;
        if (!selectedStop) return;

        setDuplicatingStop(true);
        try {
            await stopsApi.create(routeId, {
                address: selectedStop.address,
                latitude: selectedStop.latitude,
                longitude: selectedStop.longitude,
                notes: undefined,
                type: StopType.DELIVERY,
                estimated_duration_seconds: 180,
                package_count: 1,
            } as any);

            setSelectedStop(null);
            await load();
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible de dupliquer l'arrêt");
        } finally {
            setDuplicatingStop(false);
        }
    };

    const handleDeleteStop = async () => {
        if (!routeId) return;
        if (!selectedStop) return;

        Alert.alert('Supprimer', 'Supprimer cet arrêt ?', [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: async () => {
                    setDeletingStop(true);
                    try {
                        await stopsApi.delete(routeId, selectedStop.id);
                        setSelectedStop(null);
                        await load();
                    } catch (error: any) {
                        Alert.alert('Erreur', error?.message ?? "Impossible de supprimer l'arrêt");
                    } finally {
                        setDeletingStop(false);
                    }
                },
            },
        ]);
    };

    const stops: Stop[] = route?.stops ?? [];

    const openAddStop = () => {
        addStopSheetRef.current?.present();
    };

    const handleAddStopSubmit = async (payload: StopPayload) => {
        if (!routeId) return;

        const estimatedDurationSeconds = Math.max(0, Math.round(payload.durationMinutes * 60));
        const packageCount = Math.max(0, Math.round(payload.packageCount));
        const sequenceOrder = payload.order === 'first' ? 0 : payload.order === 'last' ? 9999 : undefined;

        await stopsApi.create(routeId, {
            address: payload.address,
            latitude: payload.latitude,
            longitude: payload.longitude,
            notes: payload.notes || undefined,
            type: payload.type,
            estimated_duration_seconds: estimatedDurationSeconds,
            package_count: packageCount,
            sequence_order: sequenceOrder,
            first_name: payload.firstName || undefined,
            last_name: payload.lastName || undefined,
            phone_number: payload.phoneNumber || undefined,
        } as any);

        addStopSheetRef.current?.close();
        await load();
    };

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

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                    <TouchableOpacity
                        onPress={handleOptimize}
                        disabled={optimizing}
                        style={{
                            flex: 1,
                            backgroundColor: colors.primary,
                            padding: 14,
                            borderRadius: 12,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            opacity: optimizing ? 0.8 : 1,
                        }}
                    >
                        <Sparkle size={18} color="#FFFFFF" weight="fill" />
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginLeft: 8 }}>
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
                                onPress={() => setSelectedStop(stop)}
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

                {selectedStop && (
                    <View style={{ backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginTop: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 }}>
                            Actions sur l'arrêt
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 12 }}>
                            {selectedStop.address}
                        </Text>

                        <TouchableOpacity
                            onPress={handleDuplicateStop}
                            disabled={duplicatingStop}
                            style={{
                                backgroundColor: colors.background,
                                padding: 14,
                                borderRadius: 12,
                                marginBottom: 12,
                                opacity: duplicatingStop ? 0.8 : 1,
                            }}
                        >
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                                {duplicatingStop ? 'Duplication...' : "Dupliquer l'arrêt"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDeleteStop}
                            disabled={deletingStop}
                            style={{
                                backgroundColor: '#DC2626',
                                padding: 14,
                                borderRadius: 12,
                                opacity: deletingStop ? 0.8 : 1,
                            }}
                        >
                            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Supprimer l'arrêt</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setSelectedStop(null)}
                            style={{
                                backgroundColor: colors.background,
                                padding: 14,
                                borderRadius: 12,
                                marginTop: 12,
                            }}
                        >
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>Fermer</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <AddStopBottomSheet
                ref={addStopSheetRef}
                onPressAdd={handleAddStopSubmit}
            />
        </View>
    );
}
