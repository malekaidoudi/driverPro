import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../hooks/useTheme';

interface HeaderProps {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBackPress?: () => void;
    rightIcon?: React.ReactNode;
    onRightPress?: () => void;
    style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    showBack = true,
    onBackPress,
    rightIcon,
    onRightPress,
    style,
}) => {
    const { colors } = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const handleBackPress = () => {
        if (onBackPress) {
            onBackPress();
        } else {
            router.back();
        }
    };

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                    paddingTop: insets.top + 8,
                },
                style,
            ]}
        >
            <View style={styles.content}>
                {showBack ? (
                    <TouchableOpacity
                        onPress={handleBackPress}
                        style={styles.backButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ArrowLeft size={24} color={colors.textPrimary} weight="bold" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}

                <View style={styles.titleContainer}>
                    <Text
                        style={[styles.title, { color: colors.textPrimary }]}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    {subtitle && (
                        <Text
                            style={[styles.subtitle, { color: colors.textSecondary }]}
                            numberOfLines={1}
                        >
                            {subtitle}
                        </Text>
                    )}
                </View>

                {rightIcon ? (
                    <TouchableOpacity
                        onPress={onRightPress}
                        style={styles.rightButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {rightIcon}
                    </TouchableOpacity>
                ) : (
                    <View style={styles.placeholder} />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 24,
        paddingBottom: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        fontFamily: 'Inter-SemiBold',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 2,
        fontFamily: 'Inter-Regular',
    },
    rightButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholder: {
        width: 44,
    },
});
