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
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);

    const getBorderColor = (): string => {
        if (error) return colors.danger;
        if (isFocused) return colors.primary;
        return colors.border;
    };

    const inputContainerStyle: ViewStyle = {
        backgroundColor: colors.surface,
        borderColor: getBorderColor(),
        borderWidth: isFocused ? 2 : 1,
        borderRadius: 12,
        height: 52,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
    };

    const textInputStyle: TextStyle = {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Inter-Regular',
        color: colors.textPrimary,
    };

    const labelStyle: TextStyle = {
        fontSize: 14,
        fontFamily: 'Inter-Medium',
        color: colors.textSecondary,
        marginBottom: 8,
    };

    const errorStyle: TextStyle = {
        fontSize: 12,
        fontFamily: 'Inter-Regular',
        color: colors.danger,
        marginTop: 4,
    };

    return (
        <View style={containerStyle}>
            {label && <Text style={labelStyle}>{label}</Text>}
            <View style={inputContainerStyle}>
                {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
                <TextInput
                    style={[textInputStyle, inputStyle]}
                    placeholderTextColor={colors.textSecondary}
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
