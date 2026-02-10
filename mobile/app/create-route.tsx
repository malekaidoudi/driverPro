import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/contexts/ThemeContext';
import { routesApi } from '../src/services/api';
import { AddressAutocomplete } from '../src/components/AddressAutocomplete';

const getDefaultRouteName = (): string => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${dayName} ${day}/${month}`;
};

export default function CreateRouteScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    const [name, setName] = useState(getDefaultRouteName());
    const [routeDate, setRouteDate] = useState(new Date().toISOString().slice(0, 10));
    const [startAddress, setStartAddress] = useState('');
    const [endAddress, setEndAddress] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert('Erreur', 'Veuillez saisir un nom de tournée');
            return;
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(routeDate)) {
            Alert.alert('Erreur', 'Format de date invalide (YYYY-MM-DD)');
            return;
        }

        setLoading(true);
        try {
            const route = await routesApi.create({
                name: name.trim(),
                route_date: routeDate,
                start_address: startAddress.trim() || undefined,
                end_address: endAddress.trim() || undefined,
            });
            router.replace(`/route/${route.id}`);
        } catch (error: any) {
            Alert.alert('Erreur', error?.message ?? "Impossible de créer la tournée");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 24, paddingTop: 60, paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.textPrimary }}>
                    Nouvelle tournée
                </Text>
                <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6, marginBottom: 24 }}>
                    Créez une tournée, puis ajoutez vos stops
                </Text>

                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Nom
                </Text>
                <TextInput
                    placeholder="Ex: Tournée du matin"
                    value={name}
                    onChangeText={setName}
                    style={{
                        backgroundColor: colors.surface,
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 16,
                        fontSize: 16,
                        color: colors.textPrimary,
                    }}
                    placeholderTextColor={colors.textSecondary}
                />

                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 }}>
                    Date (YYYY-MM-DD)
                </Text>
                <TextInput
                    placeholder="2026-01-27"
                    value={routeDate}
                    onChangeText={setRouteDate}
                    autoCapitalize="none"
                    style={{
                        backgroundColor: colors.surface,
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 16,
                        fontSize: 16,
                        color: colors.textPrimary,
                    }}
                    placeholderTextColor={colors.textSecondary}
                />

                <View style={{ zIndex: 2 }}>
                    <AddressAutocomplete
                        label="Point de départ (optionnel)"
                        placeholder="Ex: 123 Rue de la Gare, 69001 Lyon"
                        value={startAddress}
                        onChangeText={setStartAddress}
                        onSelectAddress={(address) => setStartAddress(address)}
                    />
                </View>

                <View style={{ zIndex: 1 }}>
                    <AddressAutocomplete
                        label="Point d'arrivée (optionnel)"
                        placeholder="Ex: Même que départ"
                        value={endAddress}
                        onChangeText={setEndAddress}
                        onSelectAddress={(address) => setEndAddress(address)}
                    />
                </View>

                <View style={{ height: 8 }} />

                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={loading}
                    style={{
                        backgroundColor: colors.primary,
                        padding: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginBottom: 12,
                        opacity: loading ? 0.8 : 1,
                    }}
                >
                    <Text style={{ color: '#351C15', fontSize: 16, fontWeight: '600' }}>
                        {loading ? 'Création...' : 'Créer la tournée'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()} disabled={loading}>
                    <Text style={{ textAlign: 'center', color: colors.textSecondary }}>
                        Annuler
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
