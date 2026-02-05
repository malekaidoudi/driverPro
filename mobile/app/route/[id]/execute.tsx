import { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Linking, Platform, ActionSheetIOS, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { routesApi, stopsApi } from '../../../src/services/api';
import { Route, Stop, StopStatus, FailureType } from '../../../src/types';
import { ArrowLeft, Phone, NavigationArrow, Check, X, List, SkipForward, MapPin } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, runOnJS } from 'react-native-reanimated';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ExecuteRouteScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const routeId = Array.isArray(id) ? id[0] : id;

    const { colors } = useTheme();
    const router = useRouter();

    const [route, setRoute] = useState<Route | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentStopIndex, setCurrentStopIndex] = useState(0);
    const [processingAction, setProcessingAction] = useState(false);

    const mapRef = useRef<MapView>(null);
    const failureSheetRef = useRef<BottomSheet>(null);

    // Animation for success
    const successScale = useSharedValue(1);
    const successAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: successScale.value }],
    }));

    const load = useCallback(async () => {
        if (!routeId) return;
        try {
            const data = await routesApi.getById(routeId);
            setRoute(data);

            // Find first pending stop
            const pendingIndex = data.stops?.findIndex(s => s.status === StopStatus.PENDING) ?? 0;
            setCurrentStopIndex(Math.max(0, pendingIndex));
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
    const currentStop = stops[currentStopIndex];
    const completedCount = stops.filter(s => s.status === StopStatus.COMPLETED).length;
    const totalCount = stops.length;

    // Center map on current stop
    useEffect(() => {
        if (currentStop && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: currentStop.latitude,
                longitude: currentStop.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }, 500);
        }
    }, [currentStop]);

    const openIntegratedNavigation = () => {
        router.push(`/route/${routeId}/navigate?stopIndex=${currentStopIndex}`);
    };

    const openNavigationSelector = () => {
        if (!currentStop) return;

        const { latitude, longitude, address } = currentStop;
        const encodedAddress = encodeURIComponent(address);

        const externalOptions = [
            { label: 'Google Maps', url: `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving` },
            { label: 'Waze', url: `waze://?ll=${latitude},${longitude}&navigate=yes` },
            { label: 'Plans Apple', url: `maps://?daddr=${encodedAddress}&dirflg=d` },
        ];

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: 'Ouvrir avec...',
                    options: ['📍 Navigation intégrée', ...externalOptions.map(o => o.label), 'Annuler'],
                    cancelButtonIndex: externalOptions.length + 1,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 0) {
                        // Integrated navigation
                        openIntegratedNavigation();
                    } else if (buttonIndex <= externalOptions.length) {
                        const url = externalOptions[buttonIndex - 1].url;
                        const canOpen = await Linking.canOpenURL(url);
                        if (canOpen) {
                            Linking.openURL(url);
                        } else {
                            // Fallback to web
                            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
                        }
                    }
                }
            );
        } else {
            // Android - use Alert for simplicity
            Alert.alert('Ouvrir avec...', '', [
                {
                    text: '📍 Navigation intégrée',
                    onPress: openIntegratedNavigation,
                },
                ...externalOptions.map(o => ({
                    text: o.label,
                    onPress: async () => {
                        const canOpen = await Linking.canOpenURL(o.url);
                        if (canOpen) {
                            Linking.openURL(o.url);
                        } else {
                            Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
                        }
                    },
                })),
                { text: 'Annuler', style: 'cancel' },
            ]);
        }
    };

    const handleMarkDelivered = async () => {
        if (!routeId || !currentStop || processingAction) return;

        setProcessingAction(true);
        try {
            await stopsApi.update(routeId, currentStop.id, { status: StopStatus.COMPLETED });

            // Success haptic and animation
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            successScale.value = withSequence(
                withSpring(1.2, { damping: 2 }),
                withSpring(1, { damping: 10 })
            );

            // Move to next stop
            setTimeout(() => {
                if (currentStopIndex < stops.length - 1) {
                    setCurrentStopIndex(prev => prev + 1);
                } else {
                    Alert.alert('🎉 Tournée terminée!', 'Tous les stops ont été livrés.', [
                        { text: 'OK', onPress: () => router.back() }
                    ]);
                }
                load();
            }, 300);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? 'Impossible de marquer comme livré');
        } finally {
            setProcessingAction(false);
        }
    };

    const handleFailure = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        failureSheetRef.current?.expand();
    };

    const handleFailureType = async (failureType: FailureType) => {
        if (!routeId || !currentStop || processingAction) return;

        setProcessingAction(true);
        try {
            await stopsApi.recordFailure(currentStop.id, {
                failure_type: failureType,
                attempt_number: (currentStop.attempt_count || 0) + 1,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            failureSheetRef.current?.close();

            // Move to next stop
            if (currentStopIndex < stops.length - 1) {
                setCurrentStopIndex(prev => prev + 1);
            }
            load();
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible d'enregistrer l'échec");
        } finally {
            setProcessingAction(false);
        }
    };

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (currentStopIndex < stops.length - 1) {
            setCurrentStopIndex(prev => prev + 1);
        }
    };

    const handleCall = () => {
        if (currentStop?.phone_number) {
            Linking.openURL(`tel:${currentStop.phone_number}`);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!route || !currentStop) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>
                    Aucun stop à livrer
                </Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Retour</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Map */}
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ height: SCREEN_HEIGHT * 0.4 }}
                initialRegion={{
                    latitude: currentStop.latitude,
                    longitude: currentStop.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
            >
                <Marker
                    coordinate={{ latitude: currentStop.latitude, longitude: currentStop.longitude }}
                    title={currentStop.address}
                >
                    <View style={{ backgroundColor: colors.primary, padding: 8, borderRadius: 20 }}>
                        <MapPin size={24} color="#FFFFFF" weight="fill" />
                    </View>
                </Marker>
            </MapView>

            {/* Header overlay */}
            <View style={{ position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{ backgroundColor: colors.surface, padding: 12, borderRadius: 12 }}
                >
                    <ArrowLeft size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <View style={{ backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                        {completedCount}/{totalCount} livrés
                    </Text>
                </View>
            </View>

            {/* Stop details card */}
            <View style={{ flex: 1, padding: 16 }}>
                <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, flex: 1 }}>
                    {/* Stop number */}
                    <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '700', marginBottom: 8 }}>
                        #{currentStopIndex + 1}/{totalCount}
                    </Text>

                    {/* Address */}
                    <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
                        {currentStop.address}
                    </Text>
                    {currentStop.city && (
                        <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 16 }}>
                            {currentStop.postal_code} {currentStop.city}
                        </Text>
                    )}

                    {/* Navigate button */}
                    <TouchableOpacity
                        onPress={openNavigationSelector}
                        style={{
                            backgroundColor: colors.primary,
                            paddingVertical: 14,
                            borderRadius: 12,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 16,
                        }}
                    >
                        <NavigationArrow size={20} color="#FFFFFF" weight="bold" />
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                            NAVIGUER
                        </Text>
                    </TouchableOpacity>

                    {/* Contact info */}
                    {(currentStop.first_name || currentStop.last_name) && (
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 }}>
                            {[currentStop.first_name, currentStop.last_name].filter(Boolean).join(' ')}
                        </Text>
                    )}

                    {currentStop.phone_number && (
                        <TouchableOpacity
                            onPress={handleCall}
                            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
                        >
                            <Phone size={18} color={colors.primary} />
                            <Text style={{ color: colors.primary, marginLeft: 8, fontWeight: '600' }}>
                                {currentStop.phone_number}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {currentStop.time_window_start && currentStop.time_window_end && (
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 8 }}>
                            🕐 {currentStop.time_window_start} - {currentStop.time_window_end}
                        </Text>
                    )}

                    {currentStop.notes && (
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>
                            📝 {currentStop.notes}
                        </Text>
                    )}

                    {/* Spacer */}
                    <View style={{ flex: 1 }} />

                    {/* Action buttons */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Animated.View style={[{ flex: 1 }, successAnimatedStyle]}>
                            <TouchableOpacity
                                onPress={handleMarkDelivered}
                                disabled={processingAction}
                                style={{
                                    backgroundColor: '#22C55E',
                                    paddingVertical: 18,
                                    borderRadius: 12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: processingAction ? 0.7 : 1,
                                }}
                            >
                                <Check size={24} color="#FFFFFF" weight="bold" />
                                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
                                    LIVRÉ
                                </Text>
                            </TouchableOpacity>
                        </Animated.View>

                        <TouchableOpacity
                            onPress={handleFailure}
                            disabled={processingAction}
                            style={{
                                flex: 1,
                                backgroundColor: '#EF4444',
                                paddingVertical: 18,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: processingAction ? 0.7 : 1,
                            }}
                        >
                            <X size={24} color="#FFFFFF" weight="bold" />
                            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 8 }}>
                                ÉCHEC
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Bottom actions */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                        <TouchableOpacity
                            onPress={() => router.push(`/route/${routeId}`)}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                        >
                            <List size={20} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, marginLeft: 6 }}>Liste</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSkip}
                            style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                        >
                            <Text style={{ color: colors.textSecondary, marginRight: 6 }}>Passer</Text>
                            <SkipForward size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Failure BottomSheet */}
            <BottomSheet
                ref={failureSheetRef}
                index={-1}
                snapPoints={[300]}
                enablePanDownToClose
                backgroundStyle={{ backgroundColor: colors.surface }}
                handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
            >
                <BottomSheetView style={{ padding: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 20, textAlign: 'center' }}>
                        Motif de l'échec
                    </Text>

                    <TouchableOpacity
                        onPress={() => handleFailureType(FailureType.ABSENT)}
                        style={{ backgroundColor: colors.background, padding: 16, borderRadius: 12, marginBottom: 12 }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>😴 Absent</Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Le destinataire n'est pas là</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleFailureType(FailureType.RESCHEDULED)}
                        style={{ backgroundColor: colors.background, padding: 16, borderRadius: 12, marginBottom: 12 }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>📅 Reporter</Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Reprogrammer pour plus tard</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => handleFailureType(FailureType.NO_ACCESS)}
                        style={{ backgroundColor: colors.background, padding: 16, borderRadius: 12 }}
                    >
                        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>🚫 Pas d'accès</Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>Impossible d'accéder au lieu</Text>
                    </TouchableOpacity>
                </BottomSheetView>
            </BottomSheet>
        </View>
    );
}
