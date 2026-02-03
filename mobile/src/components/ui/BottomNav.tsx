import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, ListBullets, ChartBar, GearSix } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';

type TabName = 'home' | 'routes' | 'stats' | 'settings';

interface BottomNavProps {
    activeTab: TabName;
    onTabPress: (tab: TabName) => void;
}

interface TabItem {
    name: TabName;
    label: string;
    icon: React.ComponentType<{ size: number; color: string; weight: 'regular' | 'fill' }>;
}

const tabs: TabItem[] = [
    { name: 'home', label: 'Accueil', icon: House },
    { name: 'routes', label: 'Tournées', icon: ListBullets },
    { name: 'stats', label: 'Stats', icon: ChartBar },
    { name: 'settings', label: 'Réglages', icon: GearSix },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabPress }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const handlePress = (tab: TabName) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTabPress(tab);
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                    paddingBottom: insets.bottom || 16,
                },
            ]}
        >
            {tabs.map((tab) => {
                const isActive = activeTab === tab.name;
                const IconComponent = tab.icon;

                return (
                    <TouchableOpacity
                        key={tab.name}
                        style={styles.tab}
                        onPress={() => handlePress(tab.name)}
                        activeOpacity={0.7}
                    >
                        <IconComponent
                            size={28}
                            color={isActive ? colors.primary : colors.textSecondary}
                            weight={isActive ? 'fill' : 'regular'}
                        />
                        <Text
                            style={[
                                styles.label,
                                {
                                    color: isActive ? colors.primary : colors.textSecondary,
                                    fontWeight: isActive ? '600' : '400',
                                },
                            ]}
                        >
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        borderTopWidth: 1,
        paddingTop: 8,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 4,
    },
    label: {
        fontSize: 12,
        fontFamily: 'Inter-Regular',
    },
});
