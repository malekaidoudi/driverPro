import { View, Text } from 'react-native';
import { useTheme } from '../../src/contexts/ThemeContext';

export default function RoutesScreen() {
    const { colors } = useTheme();

    return (
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary }}>
                Carte des Tournées
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 8 }}>
                Vue carte à implémenter
            </Text>
        </View>
    );
}
