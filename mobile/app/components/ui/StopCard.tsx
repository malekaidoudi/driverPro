import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DotsSixVertical, Star, ArrowsClockwise, Package } from 'phosphor-react-native';
import { useTheme } from '../../hooks/useTheme';

type Priority = 'normal' | 'high' | 'urgent';

interface StopCardProps {
    index: number;
    address: string;
    postalCode: string;
    city?: string;
    recipientName?: string;
    phone?: string;
    packageCount?: number;
    priority?: Priority;
    isFavorite?: boolean;
    isRecurrent?: boolean;
    onPress?: () => void;
    onDragStart?: () => void;
    showDragHandle?: boolean;
}

export const StopCard: React.FC<StopCardProps> = ({
    index,
    address,
    postalCode,
    city,
    recipientName,
    phone,
    packageCount = 1,
    priority = 'normal',
    isFavorite = false,
    isRecurrent = false,
    onPress,
    onDragStart,
    showDragHandle = true,
}) => {
    const { colors, isDark } = useTheme();

    const getPriorityColor = (): string => {
        switch (priority) {
            case 'urgent':
                return colors.danger;
            case 'high':
                return colors.warning;
            default:
                return colors.secondary;
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: colors.surface }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                {showDragHandle && (
                    <TouchableOpacity onPressIn={onDragStart} style={styles.dragHandle}>
                        <DotsSixVertical size={20} color={colors.textSecondary} weight="bold" />
                    </TouchableOpacity>
                )}

                <View style={styles.indexContainer}>
                    <Text style={[styles.index, { color: colors.textPrimary }]}>{index}.</Text>
                </View>

                <View style={styles.details}>
                    <Text style={[styles.address, { color: colors.textPrimary }]} numberOfLines={1}>
                        {address}
                    </Text>
                    <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
                        {postalCode}{city ? ` • ${city}` : ''}{recipientName ? ` • ${recipientName}` : ''}
                    </Text>

                    <View style={styles.badges}>
                        <View style={styles.badge}>
                            <Package size={14} color={colors.textSecondary} />
                            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                                {packageCount}
                            </Text>
                        </View>

                        <View
                            style={[styles.priorityDot, { backgroundColor: getPriorityColor() }]}
                        />

                        {isFavorite && (
                            <Star size={14} color={colors.warning} weight="fill" />
                        )}

                        {isRecurrent && (
                            <ArrowsClockwise size={14} color={colors.primary} />
                        )}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    dragHandle: {
        paddingRight: 8,
        paddingVertical: 4,
    },
    indexContainer: {
        width: 28,
    },
    index: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Inter-SemiBold',
    },
    details: {
        flex: 1,
    },
    address: {
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'Inter-Medium',
        marginBottom: 4,
    },
    location: {
        fontSize: 14,
        fontFamily: 'Inter-Regular',
        marginBottom: 8,
    },
    badges: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    badgeText: {
        fontSize: 12,
        fontFamily: 'Inter-Medium',
    },
    priorityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
