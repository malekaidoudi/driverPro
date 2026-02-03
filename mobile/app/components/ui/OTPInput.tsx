import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    TextInput,
    StyleSheet,
    Animated,
    Keyboard,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';

interface OTPInputProps {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    onComplete?: (value: string) => void;
    error?: boolean;
    autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
    length = 6,
    value,
    onChange,
    onComplete,
    error = false,
    autoFocus = true,
}) => {
    const { colors } = useTheme();
    const inputRefs = useRef<TextInput[]>([]);
    const shakeAnimation = useRef(new Animated.Value(0)).current;
    const [focusedIndex, setFocusedIndex] = useState(0);

    useEffect(() => {
        if (error) {
            triggerShake();
        }
    }, [error]);

    useEffect(() => {
        if (value.length === length && onComplete) {
            onComplete(value);
        }
    }, [value, length, onComplete]);

    const triggerShake = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Animated.sequence([
            Animated.timing(shakeAnimation, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(shakeAnimation, {
                toValue: -10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(shakeAnimation, {
                toValue: 10,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.timing(shakeAnimation, {
                toValue: 0,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleChange = (text: string, index: number) => {
        const newValue = value.split('');
        
        if (text.length > 1) {
            const pastedCode = text.slice(0, length);
            onChange(pastedCode);
            if (pastedCode.length === length) {
                Keyboard.dismiss();
            }
            return;
        }

        newValue[index] = text;
        const newCode = newValue.join('');
        onChange(newCode);

        if (text && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        if (text) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
            const newValue = value.split('');
            newValue[index - 1] = '';
            onChange(newValue.join(''));
        }
    };

    const handleFocus = (index: number) => {
        setFocusedIndex(index);
    };

    const getCellStyle = (index: number) => {
        const isFilled = !!value[index];
        const isFocused = focusedIndex === index;

        return {
            borderColor: error
                ? colors.danger
                : isFocused
                ? colors.primary
                : isFilled
                ? colors.textSecondary
                : colors.border,
            borderWidth: isFocused ? 2 : 1,
            backgroundColor: colors.surface,
        };
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateX: shakeAnimation }] },
            ]}
        >
            {Array.from({ length }).map((_, index) => (
                <TextInput
                    key={index}
                    ref={(ref) => {
                        if (ref) inputRefs.current[index] = ref;
                    }}
                    style={[styles.cell, getCellStyle(index), { color: colors.textPrimary }]}
                    value={value[index] || ''}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    onFocus={() => handleFocus(index)}
                    keyboardType="number-pad"
                    maxLength={length}
                    autoFocus={autoFocus && index === 0}
                    selectTextOnFocus
                />
            ))}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    cell: {
        width: 48,
        height: 56,
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'Inter-Bold',
    },
});
