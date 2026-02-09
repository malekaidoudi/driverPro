import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function SignupScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const { signUp } = useAuth();
    const { colors } = useTheme();
    const router = useRouter();

    const handleSignup = async () => {
        if (!email || !password || !fullName) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        setLoading(true);
        try {
            await signUp(email, password, fullName);
            Alert.alert('Succès', 'Compte créé ! Vérifiez votre email pour confirmer votre compte.');
            router.replace('/(auth)/login');
        } catch (error: any) {
            Alert.alert('Erreur d\'inscription', error.message);
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
                    Créer un compte
                </Text>
                <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 32 }}>
                    Rejoignez UpsDriver pour optimiser vos tournées
                </Text>

                <TextInput
                    placeholder="Nom complet"
                    value={fullName}
                    onChangeText={setFullName}
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
                    onPress={handleSignup}
                    disabled={loading}
                    style={{
                        backgroundColor: colors.primary,
                        padding: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        marginBottom: 16,
                    }}
                >
                    <Text style={{ color: '#351C15', fontSize: 16, fontWeight: '600' }}>
                        {loading ? 'Création...' : 'S\'inscrire'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={{ textAlign: 'center', color: colors.textSecondary }}>
                        Déjà un compte ?{' '}
                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Se connecter</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
