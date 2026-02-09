import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { routesApi } from '../../src/services/api';
import { RouteGroupedByDate, Route } from '../../src/types';
import { Plus, MapPin, DotsThreeVertical, PencilSimple, Copy, Trash } from 'phosphor-react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';

export default function HomeScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [routesData, setRoutesData] = useState<RouteGroupedByDate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [menuRoute, setMenuRoute] = useState<Route | null>(null);
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameRouteId, setRenameRouteId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');

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

    const openMenu = (route: Route) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setMenuRoute(route);
    };

    const closeMenu = () => {
        setMenuRoute(null);
    };

    const handleRename = () => {
        if (!menuRoute) return;
        setRenameRouteId(menuRoute.id);
        setNewName(menuRoute.name || '');
        closeMenu();
        setRenameModalVisible(true);
    };

    const confirmRename = async () => {
        if (!renameRouteId || !newName.trim()) return;
        try {
            await routesApi.update(renameRouteId, { name: newName.trim() });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            loadRoutes();
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de renommer la tournée');
        } finally {
            setRenameModalVisible(false);
            setRenameRouteId(null);
            setNewName('');
        }
    };

    const handleDuplicate = async () => {
        if (!menuRoute) return;
        closeMenu();
        try {
            const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
            const now = new Date();
            const dayName = days[now.getDay()];
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const newRouteName = `${dayName} ${day}/${month} (copie)`;

            const newRoute = await routesApi.create({
                name: newRouteName,
                route_date: now.toISOString().slice(0, 10),
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push(`/route/${newRoute.id}`);
        } catch (error) {
            Alert.alert('Erreur', 'Impossible de dupliquer la tournée');
        }
    };

    const handleDelete = () => {
        if (!menuRoute) return;
        closeMenu();
        Alert.alert(
            'Supprimer la tournée',
            `Êtes-vous sûr de vouloir supprimer "${menuRoute.name}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await routesApi.delete(menuRoute.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            loadRoutes();
                        } catch (error) {
                            Alert.alert('Erreur', 'Impossible de supprimer la tournée');
                        }
                    },
                },
            ]
        );
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
                                const statusColor = route.status === 'completed' ? colors.success : colors.primary;
                                const distanceKm = route.total_distance_meters ? (route.total_distance_meters / 1000).toFixed(1) : null;

                                return (
                                    <View
                                        key={route.id}
                                        style={{
                                            backgroundColor: colors.surface,
                                            borderRadius: 12,
                                            marginBottom: 12,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <TouchableOpacity
                                            onPress={() => router.push(`/route/${route.id}`)}
                                            style={{ flex: 1, padding: 16 }}
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
                                        <TouchableOpacity
                                            onPress={() => openMenu(route)}
                                            style={{ padding: 16 }}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            <DotsThreeVertical size={24} color={colors.textSecondary} weight="bold" />
                                        </TouchableOpacity>
                                    </View>
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

            {/* Kebab Menu Modal */}
            <Modal
                visible={menuRoute !== null}
                transparent
                animationType="fade"
                onRequestClose={closeMenu}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={closeMenu}
                >
                    <View style={{
                        backgroundColor: colors.surface,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        padding: 16,
                        paddingBottom: 40,
                    }}>
                        <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }} />
                        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>
                            {menuRoute?.name || 'Sans nom'}
                        </Text>

                        <TouchableOpacity onPress={handleRename} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
                            <PencilSimple size={24} color={colors.textPrimary} />
                            <Text style={{ fontSize: 16, color: colors.textPrimary, marginLeft: 16 }}>Renommer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleDuplicate} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
                            <Copy size={24} color={colors.textPrimary} />
                            <Text style={{ fontSize: 16, color: colors.textPrimary, marginLeft: 16 }}>Dupliquer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleDelete} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
                            <Trash size={24} color={colors.danger} />
                            <Text style={{ fontSize: 16, color: colors.danger, marginLeft: 16 }}>Supprimer</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Rename Modal */}
            <Modal
                visible={renameModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRenameModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}>
                    <View style={{
                        backgroundColor: colors.surface,
                        borderRadius: 16,
                        padding: 20,
                    }}>
                        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 }}>
                            Renommer la tournée
                        </Text>
                        <TextInput
                            value={newName}
                            onChangeText={setNewName}
                            placeholder="Nom de la tournée"
                            placeholderTextColor={colors.textSecondary}
                            autoFocus
                            style={{
                                backgroundColor: colors.background,
                                padding: 14,
                                borderRadius: 10,
                                fontSize: 16,
                                color: colors.textPrimary,
                                marginBottom: 16,
                            }}
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity
                                onPress={() => setRenameModalVisible(false)}
                                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                            >
                                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={confirmRename}
                                style={{
                                    backgroundColor: colors.primary,
                                    paddingVertical: 10,
                                    paddingHorizontal: 20,
                                    borderRadius: 8,
                                }}
                            >
                                <Text style={{ color: '#FFF', fontWeight: '600' }}>Enregistrer</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
