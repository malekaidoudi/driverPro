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
import { componentSizes, radius, shadows } from '../../theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
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
    const { colors, isDark } = useTheme();

    const handlePress = () => {
        if (haptic) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress();
    };

    const getBackgroundColor = (): string => {
        if (disabled) return colors.bgElevated;
        switch (variant) {
            case 'primary':
                return colors.primary;
            case 'secondary':
                return colors.bgTertiary;
            case 'ghost':
                return 'transparent';
            case 'danger':
                return isDark ? 'transparent' : colors.bgPrimary;
            case 'success':
                return colors.success;
            default:
                return colors.primary;
        }
    };

    const getTextColor = (): string => {
        if (disabled) return colors.textTertiary;
        switch (variant) {
            case 'primary':
            case 'success':
                return colors.textInverse;
            case 'secondary':
                return colors.textPrimary;
            case 'ghost':
                return colors.primary;
            case 'danger':
                return colors.danger;
            default:
                return colors.textInverse;
        }
    };

    const getBorderStyle = (): { borderColor: string; borderWidth: number } => {
        switch (variant) {
            case 'secondary':
                return { borderColor: colors.border, borderWidth: 1 };
            case 'danger':
                return { borderColor: colors.danger, borderWidth: 2 };
            default:
                return { borderColor: 'transparent', borderWidth: 0 };
        }
    };

    const getHeight = (): number => {
        switch (size) {
            case 'small':
                return componentSizes.button.heightSm;
            case 'icon':
                return componentSizes.button.heightSm;
            default:
                return componentSizes.button.height;
        }
    };

    const getShadow = () => {
        if (disabled || variant === 'ghost' || variant === 'secondary') return {};
        const shadowSet = isDark ? shadows.dark : shadows.light;
        return shadowSet.md;
    };

    const borderStyle = getBorderStyle();

    const containerStyle: ViewStyle = {
        backgroundColor: getBackgroundColor(),
        borderColor: borderStyle.borderColor,
        borderWidth: borderStyle.borderWidth,
        height: getHeight(),
        minWidth: size === 'icon' ? componentSizes.touchTarget.min : undefined,
        borderRadius: size === 'icon' ? radius.full : radius.lg,
        paddingHorizontal: size === 'icon' ? 0 : componentSizes.button.paddingX,
        opacity: disabled ? 0.5 : 1,
        ...getShadow(),
    };

    const labelStyle: TextStyle = {
        color: getTextColor(),
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Inter',
    };

    return (
        <TouchableOpacity
            style={[styles.container, containerStyle, style]}
            onPress={handlePress}
            disabled={disabled || loading}
            activeOpacity={0.85}
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
