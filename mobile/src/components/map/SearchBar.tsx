import React, { memo, useCallback } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    Platform,
    StyleSheet,
} from 'react-native';
import { MagnifyingGlass, Microphone, Camera, Crosshair, X } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';

interface SearchBarProps {
    searchQuery: string;
    onSearchChange: (text: string) => void;
    onFocus: () => void;
    onBlur: () => void;
    onClear: () => void;
    onCameraPress?: () => void;
    onMicrophonePress?: () => void;
    onMapSelectPress: () => void;
    selectingFromMap: boolean;
    colors: {
        surface: string;
        textPrimary: string;
        textSecondary: string;
        primary: string;
    };
}

const SearchBar = memo(function SearchBar({
    searchQuery,
    onSearchChange,
    onFocus,
    onBlur,
    onClear,
    onCameraPress,
    onMicrophonePress,
    onMapSelectPress,
    selectingFromMap,
    colors,
}: SearchBarProps) {
    const handleMapSelectPress = useCallback(() => {
        onMapSelectPress();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [onMapSelectPress]);

    return (
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
            <MagnifyingGlass size={20} color={colors.textSecondary} />
            <TextInput
                value={searchQuery}
                onChangeText={onSearchChange}
                onFocus={onFocus}
                onBlur={onBlur}
                placeholder="Tapez une adresse..."
                placeholderTextColor={colors.textSecondary}
                style={[
                    styles.input,
                    { color: colors.textPrimary }
                ]}
            />
            {searchQuery.length > 0 && (
                <TouchableOpacity onPress={onClear} style={styles.iconButton}>
                    <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
            )}
            {onCameraPress && (
                <TouchableOpacity onPress={onCameraPress} style={styles.iconButton}>
                    <Camera size={22} color={colors.textPrimary} />
                </TouchableOpacity>
            )}
            {onMicrophonePress && (
                <TouchableOpacity onPress={onMicrophonePress} style={styles.iconButton}>
                    <Microphone size={22} color={colors.textPrimary} />
                </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleMapSelectPress} style={styles.iconButton}>
                <Crosshair 
                    size={22} 
                    color={selectingFromMap ? colors.primary : colors.textPrimary} 
                    weight={selectingFromMap ? 'fill' : 'regular'} 
                />
            </TouchableOpacity>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    input: {
        flex: 1,
        marginLeft: 10,
        fontSize: 16,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    },
    iconButton: {
        padding: 6,
    },
});

export default SearchBar;
