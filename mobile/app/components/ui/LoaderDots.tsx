import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface LoaderDotsProps {
    count?: number;
    size?: number;
    color?: string;
}

export const LoaderDots: React.FC<LoaderDotsProps> = ({
    count = 4,
    size = 8,
    color,
}) => {
    const { colors } = useTheme();
    const animations = useRef(
        Array.from({ length: count }, () => new Animated.Value(0))
    ).current;

    useEffect(() => {
        const animateDots = () => {
            const sequence = animations.map((anim, index) =>
                Animated.sequence([
                    Animated.delay(index * 150),
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ])
            );

            Animated.loop(Animated.parallel(sequence)).start();
        };

        animateDots();

        return () => {
            animations.forEach((anim) => anim.stopAnimation());
        };
    }, [animations]);

    const dotColor = color || colors.primary;

    return (
        <View style={styles.container}>
            {animations.map((anim, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.dot,
                        {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            backgroundColor: dotColor,
                            opacity: anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.3, 1],
                            }),
                            transform: [
                                {
                                    scale: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 1.2],
                                    }),
                                },
                            ],
                        },
                    ]}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    dot: {},
});
