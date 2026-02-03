import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Package, Clock, MapPin, TrendUp } from 'phosphor-react-native';
import { useTheme } from '../../hooks/useTheme';

interface StatItem {
    icon: 'deliveries' | 'time' | 'distance' | 'rate';
    value: string | number;
    label?: string;
}

interface StatsBannerProps {
    stats: StatItem[];
    variant?: 'horizontal' | 'grid';
}

export const StatsBanner: React.FC<StatsBannerProps> = ({
    stats,
    variant = 'horizontal',
}) => {
    const { colors } = useTheme();

    const getIcon = (iconType: StatItem['icon']) => {
        const iconProps = { size: 20, color: colors.primary };
        switch (iconType) {
            case 'deliveries':
                return <Package {...iconProps} />;
            case 'time':
                return <Clock {...iconProps} />;
            case 'distance':
                return <MapPin {...iconProps} />;
            case 'rate':
                return <TrendUp {...iconProps} />;
        }
    };

    if (variant === 'grid') {
        return (
            <View style={styles.gridContainer}>
                {stats.map((stat, index) => (
                    <View
                        key={index}
                        style={[styles.gridItem, { backgroundColor: colors.surface }]}
                    >
                        {getIcon(stat.icon)}
                        <Text style={[styles.gridValue, { color: colors.textPrimary }]}>
                            {stat.value}
                        </Text>
                        {stat.label && (
                            <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>
                                {stat.label}
                            </Text>
                        )}
                    </View>
                ))}
            </View>
        );
    }

    return (
        <View style={[styles.horizontalContainer, { backgroundColor: colors.surface }]}>
            {stats.map((stat, index) => (
                <React.Fragment key={index}>
                    <View style={styles.horizontalItem}>
                        {getIcon(stat.icon)}
                        <Text style={[styles.horizontalValue, { color: colors.textPrimary }]}>
                            {stat.value}
                        </Text>
                    </View>
                    {index < stats.length - 1 && (
                        <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    )}
                </React.Fragment>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    horizontalContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
    },
    horizontalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    horizontalValue: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Inter-SemiBold',
    },
    divider: {
        width: 1,
        height: 24,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    gridItem: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 8,
    },
    gridValue: {
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'Inter-Bold',
    },
    gridLabel: {
        fontSize: 12,
        fontFamily: 'Inter-Regular',
        textAlign: 'center',
    },
});
