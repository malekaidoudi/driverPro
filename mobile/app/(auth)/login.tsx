import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);
        try {
            await signIn(email, password);
            router.replace('/(tabs)/home');
        } catch (error: any) {
            Alert.alert('Erreur de connexion', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: colors.background }}
        >
            <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
                <Text style={{ fontSize: 32, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 }}>
                    Bienvenue
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 32 }}>
                    Connectez-vous à votre compte DriverPro
                </Text>

                <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
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

                <TextInput
                    placeholder="Mot de passe"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    style={{
                        backgroundColor: colors.surface,
                        padding: 16,
                        borderRadius: 12,
                        marginBottom: 24,
                        fontSize: 16,
                        color: colors.textPrimary,
                    }}
                    placeholderTextColor={colors.textSecondary}
                />

                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    style={{
                        backgroundColor: colors.primary,
                        padding: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginBottom: 16,
                    }}
                >
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                        {loading ? 'Connexion...' : 'Se connecter'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
                    <Text style={{ textAlign: 'center', color: colors.textSecondary }}>
                        Pas encore de compte ?{' '}
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>S'inscrire</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
