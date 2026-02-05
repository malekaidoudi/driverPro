import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { componentSizes, radius, shadows } from '../../theme/tokens';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    onPress?: () => void;
    variant?: 'default' | 'active' | 'warning' | 'success' | 'elevated';
    borderLeftColor?: string;
    noPadding?: boolean;
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    onPress,
    variant = 'default',
    borderLeftColor,
    noPadding = false,
}) => {
    const { colors, isDark } = useTheme();

    const shadowStyle = isDark ? shadows.dark.card : shadows.light.card;

    const cardStyle: ViewStyle = {
        backgroundColor: isDark ? colors.bgTertiary : colors.bgPrimary,
        borderRadius: radius.xl,
        padding: noPadding ? 0 : componentSizes.card.padding,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadowStyle,
        ...(borderLeftColor && {
            borderLeftWidth: 4,
            borderLeftColor,
        }),
    };

    const getVariantStyle = (): ViewStyle => {
        switch (variant) {
            case 'active':
                return {
                    borderLeftWidth: 4,
                    borderLeftColor: colors.primary,
                };
            case 'warning':
                return {
                    borderColor: colors.warning,
                    borderWidth: 1,
                    backgroundColor: colors.warningMuted,
                };
            case 'success':
                return {
                    borderLeftWidth: 4,
                    borderLeftColor: colors.success,
                    backgroundColor: colors.successMuted,
                };
            case 'elevated':
                return {
                    ...(isDark ? shadows.dark.lg : shadows.light.lg),
                    backgroundColor: isDark ? colors.bgSecondary : colors.bgPrimary,
                };
            default:
                return {};
        }
    };

    const content = (
        <View style={[cardStyle, getVariantStyle(), style]}>
            {children}
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
};

const styles = StyleSheet.create({});
