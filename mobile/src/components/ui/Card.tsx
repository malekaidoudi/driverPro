import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface CardProps {
    children: React.ReactNode;
    style?: ViewStyle;
    onPress?: () => void;
    variant?: 'default' | 'active' | 'warning';
    borderLeftColor?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    style,
    onPress,
    variant = 'default',
    borderLeftColor,
}) => {
    const { colors, isDark } = useTheme();

    const cardStyle: ViewStyle = {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.3 : 0.04,
        shadowRadius: 8,
        elevation: 2,
        ...(borderLeftColor && {
            borderLeftWidth: 4,
            borderLeftColor,
        }),
    };

    const getVariantStyle = (): ViewStyle => {
        switch (variant) {
            case 'active':
                return { borderLeftWidth: 4, borderLeftColor: colors.warning };
            case 'warning':
                return { borderColor: colors.warning, borderWidth: 1 };
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
            <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
};

const styles = StyleSheet.create({});
