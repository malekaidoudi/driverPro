import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, X, Clock, MapPin } from 'phosphor-react-native';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';

type RouteStatus = 'draft' | 'active' | 'completed';

interface RouteCardProps {
    title: string;
    date?: string;
    stopsCompleted?: number;
    stopsTotal: number;
    distance?: string;
    duration?: string;
    status: RouteStatus;
    onPress?: () => void;
    onResume?: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
    title,
    date,
    stopsCompleted = 0,
    stopsTotal,
    distance,
    duration,
    status,
    onPress,
    onResume,
}) => {
    const { colors } = useTheme();

    const getBorderColor = (): string | undefined => {
        if (status === 'active') return colors.warning;
        return undefined;
    };

    const getStatusIcon = () => {
        switch (status) {
            case 'completed':
                return <Check size={20} color={colors.secondary} weight="bold" />;
            case 'active':
                return <Clock size={20} color={colors.warning} weight="bold" />;
            default:
                return null;
        }
    };

    const getStatusLabel = (): string => {
        switch (status) {
            case 'active':
                return 'EN COURS';
            case 'completed':
                return 'TERMINÉE';
            default:
                return 'BROUILLON';
        }
    };

    const getStatusColor = (): string => {
        switch (status) {
            case 'active':
                return colors.warning;
            case 'completed':
                return colors.secondary;
            default:
                return colors.textSecondary;
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.container,
                { backgroundColor: colors.surface },
                status === 'active' && { borderLeftWidth: 4, borderLeftColor: colors.warning },
            ]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                        {title}
                    </Text>
                    {getStatusIcon()}
                </View>
                {status === 'active' && (
                    <Text style={[styles.statusLabel, { color: getStatusColor() }]}>
                        {getStatusLabel()}
                    </Text>
                )}
            </View>

            <View style={styles.stats}>
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                    {stopsCompleted}/{stopsTotal} stops
                </Text>
                {distance && (
                    <Text style={[styles.statText, { color: colors.textSecondary }]}>
                        • {distance}
                    </Text>
                )}
                {duration && (
                    <Text style={[styles.statText, { color: colors.textSecondary }]}>
                        • {duration}
                    </Text>
                )}
            </View>

            {status === 'active' && onResume && (
                <Button
                    title="REPRENDRE ▶"
                    onPress={onResume}
                    variant="primary"
                    size="small"
                    style={styles.resumeButton}
                />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        marginBottom: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        fontFamily: 'Inter-SemiBold',
        flex: 1,
    },
    statusLabel: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Inter-Bold',
        marginTop: 4,
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
    },
    resumeButton: {
        marginTop: 12,
    },
});
