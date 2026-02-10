import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    FlatList,
    StyleSheet,
} from 'react-native';
import { MapPin } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { PlacePrediction } from '../types';
import { servicesApi } from '../services/api';

type AddressAutocompleteProps = {
    value: string;
    onChangeText: (text: string) => void;
    onSelectAddress: (address: string, latitude: number, longitude: number) => void;
    placeholder?: string;
    label?: string;
    editable?: boolean;
};

export function AddressAutocomplete({
    value,
    onChangeText,
    onSelectAddress,
    placeholder = 'Rechercher une adresse...',
    label,
    editable = true,
}: AddressAutocompleteProps) {
    const { colors } = useTheme();
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [loading, setLoading] = useState(false);
    const [showPredictions, setShowPredictions] = useState(false);
    const skipAutocompleteRef = useRef(false);

    useEffect(() => {
        if (skipAutocompleteRef.current) {
            skipAutocompleteRef.current = false;
            return;
        }

        const q = value.trim();
        if (q.length < 3) {
            setPredictions([]);
            setShowPredictions(false);
            return;
        }

        setLoading(true);
        const timeout = setTimeout(async () => {
            try {
                const results = await servicesApi.autocomplete(q);
                setPredictions(results);
                setShowPredictions(results.length > 0);
            } catch {
                setPredictions([]);
                setShowPredictions(false);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [value]);

    const selectPrediction = useCallback(async (prediction: PlacePrediction) => {
        skipAutocompleteRef.current = true;
        onChangeText(prediction.description);
        setPredictions([]);
        setShowPredictions(false);
        setLoading(true);

        try {
            const details = await servicesApi.getPlaceDetails(prediction.place_id);
            onChangeText(details.address);
            onSelectAddress(details.address, details.latitude, details.longitude);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e: any) {
            console.error('Failed to get place details:', e);
        } finally {
            setLoading(false);
        }
    }, [onChangeText, onSelectAddress]);

    return (
        <View style={styles.container}>
            {label && (
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {label}
                </Text>
            )}
            <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                <MapPin size={20} color={colors.textSecondary} style={styles.icon} />
                <TextInput
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    editable={editable}
                    style={[styles.input, { color: colors.textPrimary }]}
                />
                {loading && (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
                )}
            </View>

            {showPredictions && predictions.length > 0 && (
                <View style={[styles.predictionsContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <FlatList
                        data={predictions}
                        keyExtractor={(item) => item.place_id}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled
                        style={styles.predictionsList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => selectPrediction(item)}
                                style={[styles.predictionItem, { borderBottomColor: colors.border }]}
                            >
                                <MapPin size={16} color={colors.primary} />
                                <Text
                                    style={[styles.predictionText, { color: colors.textPrimary }]}
                                    numberOfLines={2}
                                >
                                    {item.description}
                                </Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
        zIndex: 1,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 12,
    },
    icon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
    },
    loader: {
        marginLeft: 8,
    },
    predictionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 4,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    predictionsList: {
        maxHeight: 200,
    },
    predictionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        gap: 8,
    },
    predictionText: {
        flex: 1,
        fontSize: 14,
    },
});

export default AddressAutocomplete;
