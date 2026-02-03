import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { routesApi } from '../../src/services/api';
import { RouteGroupedByDate } from '../../src/types';
import { Plus, MapPin } from 'phosphor-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function HomeScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [routesData, setRoutesData] = useState<RouteGroupedByDate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setLoading(false);
            return;
        }
        loadRoutes();
    }, [authLoading, user]);

    const loadRoutes = async () => {
        try {
            const data = await routesApi.getAll();
            setRoutesData(data);
        } catch (error) {
            console.error('Failed to load routes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        loadRoutes();
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ padding: 24, paddingTop: 60 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary }}>
                    Mes Tournées
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 4 }}>
                    Gérez et optimisez vos livraisons
                </Text>

                <TouchableOpacity
                    onPress={() => router.push('/bs-test')}
                    style={{
                        marginTop: 12,
                        alignSelf: 'flex-start',
                        backgroundColor: colors.surface,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                    }}
                >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Test BottomSheet</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 24, paddingTop: 0 }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {routesData.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: 60 }}>
                        <MapPin size={64} color={colors.textSecondary} />
                        <Text style={{ fontSize: 18, color: colors.textPrimary, marginTop: 16, fontWeight: '600' }}>
                            Aucune tournée
                        </Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
                            Créez votre première tournée pour commencer
                        </Text>
                    </View>
                ) : (
                    routesData.map((group) => (
                        <View key={group.date} style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                                {format(new Date(group.date), 'EEEE d MMMM yyyy', { locale: fr }).toUpperCase()}
                            </Text>
                            {group.routes.map((route) => {
                                const statusText = route.status === 'draft' ? 'Brouillon' :
                                    route.status === 'optimized' ? 'Optimisé' :
                                        route.status === 'in_progress' ? 'En cours' :
                                            route.status === 'completed' ? 'Terminé' : '';
                                const statusColor = route.status === 'completed' ? colors.secondary : colors.primary;
                                const distanceKm = route.total_distance_meters ? (route.total_distance_meters / 1000).toFixed(1) : null;

                                return (
                                    <TouchableOpacity
                                        key={route.id}
                                        onPress={() => router.push(`/route/${route.id}`)}
                                        style={{
                                            backgroundColor: colors.surface,
                                            padding: 16,
                                            borderRadius: 12,
                                            marginBottom: 12,
                                        }}
                                    >
                                        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary }}>{route.name || 'Sans nom'}</Text>
                                        <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                                            <View style={{
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderRadius: 6,
                                                backgroundColor: statusColor + '20',
                                            }}>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusText}</Text>
                                            </View>
                                            {distanceKm !== null && (
                                                <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 12 }}>{distanceKm} km</Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ))
                )}
            </ScrollView>

            <TouchableOpacity
                onPress={() => router.push('/create-route')}
                style={{
                    position: 'absolute',
                    bottom: 24,
                    right: 24,
                    backgroundColor: colors.primary,
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    justifyContent: 'center',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}
            >
                <Plus size={32} color="#FFFFFF" weight="bold" />
            </TouchableOpacity>
        </View>
    );
}
