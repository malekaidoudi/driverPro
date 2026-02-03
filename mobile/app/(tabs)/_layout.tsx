import { Tabs } from 'expo-router';
import { useTheme } from '../../src/contexts/ThemeContext';
import { House, MapTrifold, Gear } from 'phosphor-react-native';

export default function TabsLayout() {
    const { colors } = useTheme();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.textSecondary + '20',
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Accueil',
                    tabBarIcon: ({ color, size }) => <House size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="routes"
                options={{
                    title: 'Tournées',
                    tabBarIcon: ({ color, size }) => <MapTrifold size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Paramètres',
                    tabBarIcon: ({ color, size }) => <Gear size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
