import React from 'react';
import {
    TouchableOpacity,
    Text,
    ActivityIndicator,
    StyleSheet,
    ViewStyle,
    TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'default' | 'small' | 'icon';

interface ButtonProps {
    title?: string;
    onPress: () => void;
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    style?: ViewStyle;
    textStyle?: TextStyle;
    haptic?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'default',
    disabled = false,
    loading = false,
    icon,
    iconPosition = 'left',
    style,
    textStyle,
    haptic = true,
}) => {
    const { colors } = useTheme();

    const handlePress = () => {
        if (haptic) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
    };

    const getBackgroundColor = (): string => {
        if (disabled) return colors.border;
        switch (variant) {
            case 'primary':
                return colors.primary;
            case 'secondary':
                return colors.surface;
            case 'ghost':
                return 'transparent';
            case 'danger':
                return colors.danger;
            default:
                return colors.primary;
        }
    };

    const getTextColor = (): string => {
        if (disabled) return colors.textSecondary;
        switch (variant) {
            case 'primary':
            case 'danger':
                return '#FFFFFF';
            case 'secondary':
                return colors.textPrimary;
            case 'ghost':
                return colors.primary;
            default:
                return '#FFFFFF';
        }
    };

    const getBorderColor = (): string => {
        if (variant === 'secondary') return colors.border;
        return 'transparent';
    };

    const getHeight = (): number => {
        switch (size) {
            case 'small':
                return 44;
            case 'icon':
                return 44;
            default:
                return 56;
        }
    };

    const containerStyle: ViewStyle = {
        backgroundColor: getBackgroundColor(),
        borderColor: getBorderColor(),
        borderWidth: variant === 'secondary' ? 1 : 0,
        height: getHeight(),
        minWidth: size === 'icon' ? 44 : undefined,
        borderRadius: size === 'icon' ? 22 : 12,
        paddingHorizontal: size === 'icon' ? 0 : 24,
        opacity: disabled ? 0.5 : 1,
    };

    const labelStyle: TextStyle = {
        color: getTextColor(),
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Inter-Bold',
    };

    return (
        <TouchableOpacity
            style={[styles.container, containerStyle, style]}
            onPress={handlePress}
            disabled={disabled || loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} />
            ) : (
                <>
                    {icon && iconPosition === 'left' && icon}
                    {title && (
                        <Text style={[labelStyle, icon ? styles.textWithIcon : null, textStyle]}>
                            {title}
                        </Text>
                    )}
                    {icon && iconPosition === 'right' && icon}
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    textWithIcon: {
        marginLeft: 8,
    },
});
