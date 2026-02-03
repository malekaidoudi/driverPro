import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface SkeletonLoaderProps {
    width?: number | `${number}%`;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%' as `${number}%`,
    height = 20,
    borderRadius = 8,
    style,
}) => {
    const { colors, isDark } = useTheme();
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(animatedValue, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(animatedValue, {
                    toValue: 0,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [animatedValue]);

    const opacity = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
    });

    const backgroundColor = isDark ? '#374151' : '#E5E5E5';

    return (
        <Animated.View
            style={[
                {
                    width,
                    height,
                    borderRadius,
                    backgroundColor,
                    opacity,
                },
                style,
            ]}
        />
    );
};

interface SkeletonCardProps {
    lines?: number;
    style?: ViewStyle;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ lines = 3, style }) => {
    const { colors } = useTheme();

    return (
        <View style={[styles.card, { backgroundColor: colors.surface }, style]}>
            <SkeletonLoader width="60%" height={24} style={styles.title} />
            {Array.from({ length: lines }).map((_, index) => (
                <SkeletonLoader
                    key={index}
                    width={index === lines - 1 ? '40%' : '100%'}
                    height={16}
                    style={styles.line}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
    },
    title: {
        marginBottom: 16,
    },
    line: {
        marginBottom: 8,
    },
});
