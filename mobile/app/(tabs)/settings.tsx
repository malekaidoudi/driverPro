import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { CaretRight, Moon, Sun, DeviceMobile, SignOut } from 'phosphor-react-native';

export default function SettingsScreen() {
    const { colors, theme, setTheme } = useTheme();
    const { user, signOut } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        Alert.alert(
            'Déconnexion',
            'Êtes-vous sûr de vouloir vous déconnecter ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Déconnexion',
                    style: 'destructive',
                    onPress: async () => {
                        await signOut();
                        router.replace('/(auth)/login');
                    },
                },
            ]
        );
    };

    const SettingItem = ({ icon, title, value, onPress }: any) => (
        <TouchableOpacity
            onPress={onPress}
            style={{
                backgroundColor: colors.surface,
                padding: 16,
                borderRadius: 12,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {icon}
                <Text style={{ fontSize: 16, color: colors.textPrimary, marginLeft: 12, flex: 1 }}>
                    {title}
                </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {value && (
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginRight: 8 }}>
                        {value}
                    </Text>
                )}
                <CaretRight size={20} color={colors.textSecondary} />
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ padding: 24, paddingTop: 60 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary }}>
                    Paramètres
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginTop: 4 }}>
                    {user?.email}
                </Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
                    APPARENCE
                </Text>

                <SettingItem
                    icon={theme === 'dark' ? <Moon size={24} color={colors.primary} /> : <Sun size={24} color={colors.primary} />}
                    title="Thème"
                    value={theme === 'light' ? 'Clair' : theme === 'dark' ? 'Sombre' : 'Système'}
                    onPress={() => {
                        Alert.alert(
                            'Choisir un thème',
                            '',
                            [
                                { text: 'Clair', onPress: () => setTheme('light') },
                                { text: 'Sombre', onPress: () => setTheme('dark') },
                                { text: 'Système', onPress: () => setTheme('system') },
                                { text: 'Annuler', style: 'cancel' },
                            ]
                        );
                    }}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 24, marginBottom: 12 }}>
                    PRÉFÉRENCES DE TRAJET
                </Text>

                <SettingItem
                    icon={<DeviceMobile size={24} color={colors.primary} />}
                    title="Durée d'arrêt par défaut"
                    value="3 min"
                    onPress={() => { }}
                />

                <SettingItem
                    icon={<DeviceMobile size={24} color={colors.primary} />}
                    title="Type de véhicule"
                    value="Voiture"
                    onPress={() => { }}
                />

                <SettingItem
                    icon={<DeviceMobile size={24} color={colors.primary} />}
                    title="Application de navigation"
                    value="Google Maps"
                    onPress={() => { }}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginTop: 24, marginBottom: 12 }}>
                    COMPTE
                </Text>

                <TouchableOpacity
                    onPress={handleSignOut}
                    style={{
                        backgroundColor: colors.danger + '20',
                        padding: 16,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                >
                    <SignOut size={24} color={colors.danger} />
                    <Text style={{ fontSize: 16, color: colors.danger, marginLeft: 12, fontWeight: '600' }}>
                        Déconnexion
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}
