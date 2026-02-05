import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    TextInputProps,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { componentSizes, radius, spacing } from '../../theme/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    inputStyle?: TextStyle;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    containerStyle,
    inputStyle,
    leftIcon,
    rightIcon,
    ...textInputProps
}) => {
    const { colors, isDark } = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    const getBorderColor = (): string => {
        if (error) return colors.danger;
        if (isFocused) return colors.borderFocus;
        return colors.border;
    };

    const inputContainerStyle: ViewStyle = {
        backgroundColor: isDark ? colors.bgElevated : colors.bgPrimary,
        borderColor: getBorderColor(),
        borderWidth: isFocused ? 2 : 1,
        borderRadius: radius.md,
        height: componentSizes.input.height,
        paddingHorizontal: componentSizes.input.paddingX,
        flexDirection: 'row',
        alignItems: 'center',
    };

    const textInputStyle: TextStyle = {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Inter',
        color: colors.textPrimary,
    };

    const labelStyle: TextStyle = {
        fontSize: 14,
        fontFamily: 'Inter',
        fontWeight: '500',
        color: colors.textSecondary,
        marginBottom: spacing[2],
    };

    const errorStyle: TextStyle = {
        fontSize: 12,
        fontFamily: 'Inter',
        color: colors.danger,
        marginTop: spacing[1],
    };

    return (
        <View style={containerStyle}>
            {label && <Text style={labelStyle}>{label}</Text>}
            <View style={inputContainerStyle}>
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                <TextInput
                    style={[textInputStyle, inputStyle]}
                    placeholderTextColor={colors.textTertiary}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    {...textInputProps}
                />
                {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
            </View>
            {error && <Text style={errorStyle}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    iconLeft: {
        marginRight: 12,
    },
    iconRight: {
        marginLeft: 12,
    },
});
