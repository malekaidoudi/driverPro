import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { MagnifyingGlass, Camera, Microphone, MapPin } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { PlacePrediction } from '../../types';
import { servicesApi } from '../../services/api';
import { FormSectionProps } from './types';

interface AddressSectionProps extends FormSectionProps {
    address: string;
    city: string;
    postalCode: string;
    addressComplement: string;
    latitude: number;
    longitude: number;
    onAddressChange: (address: string) => void;
    onCityChange: (city: string) => void;
    onPostalCodeChange: (postalCode: string) => void;
    onAddressComplementChange: (complement: string) => void;
    onLocationChange: (lat: number, lng: number) => void;
    onPressScanOCR: () => void;
    onPressVoiceInput: () => void;
    voiceState: 'idle' | 'listening' | 'processing';
    editable?: boolean;
}

const FRENCH_CITIES_POSTAL: Record<string, string> = {
    'paris': '75000',
    'marseille': '13000',
    'lyon': '69000',
    'toulouse': '31000',
    'nice': '06000',
    'nantes': '44000',
    'montpellier': '34000',
    'strasbourg': '67000',
    'bordeaux': '33000',
    'lille': '59000',
    'rennes': '35000',
    'reims': '51100',
    'saint-etienne': '42000',
    'toulon': '83000',
    'le havre': '76600',
    'grenoble': '38000',
    'dijon': '21000',
    'angers': '49000',
    'nimes': '30000',
    'villeurbanne': '69100',
    'saint-genis-laval': '69230',
    'venissieux': '69200',
    'oullins': '69600',
    'tassin-la-demi-lune': '69160',
    'ecully': '69130',
    'caluire-et-cuire': '69300',
    'bron': '69500',
    'meyzieu': '69330',
    'decines-charpieu': '69150',
};

export function AddressSection({
    colors,
    address,
    city,
    postalCode,
    addressComplement,
    latitude,
    longitude,
    onAddressChange,
    onCityChange,
    onPostalCodeChange,
    onAddressComplementChange,
    onLocationChange,
    onPressScanOCR,
    onPressVoiceInput,
    voiceState,
    editable = true,
}: AddressSectionProps) {
    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [cityPredictions, setCityPredictions] = useState<string[]>([]);
    const [predictionsLoading, setPredictionsLoading] = useState(false);
    const [showCityPredictions, setShowCityPredictions] = useState(false);
    const skipAutocompleteRef = useRef(false);
    const skipCityAutocompleteRef = useRef(false);

    const textSecondary = colors.textSecondary;

    useEffect(() => {
        if (skipAutocompleteRef.current) {
            skipAutocompleteRef.current = false;
            return;
        }

        if (latitude !== 0 && longitude !== 0) {
            setPredictions([]);
            return;
        }

        const q = address.trim();
        if (q.length < 3) {
            setPredictions([]);
            return;
        }

        setPredictionsLoading(true);
        const timeout = setTimeout(async () => {
            try {
                const results = await servicesApi.autocomplete(q);
                setPredictions(results);
            } catch {
                setPredictions([]);
            } finally {
                setPredictionsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timeout);
    }, [address, latitude, longitude]);

    useEffect(() => {
        if (skipCityAutocompleteRef.current) {
            skipCityAutocompleteRef.current = false;
            return;
        }

        const q = city.trim().toLowerCase();
        if (q.length < 2) {
            setCityPredictions([]);
            setShowCityPredictions(false);
            return;
        }

        const matches = Object.keys(FRENCH_CITIES_POSTAL)
            .filter(c => c.includes(q))
            .slice(0, 5)
            .map(c => c.charAt(0).toUpperCase() + c.slice(1));

        setCityPredictions(matches);
        setShowCityPredictions(matches.length > 0);
    }, [city]);

    const selectPrediction = useCallback(async (prediction: PlacePrediction) => {
        skipAutocompleteRef.current = true;
        onAddressChange(prediction.description);
        setPredictions([]);
        setPredictionsLoading(true);

        try {
            const details = await servicesApi.getPlaceDetails(prediction.place_id);
            onAddressChange(details.address);
            onLocationChange(details.latitude, details.longitude);
            
            if (details.city) {
                skipCityAutocompleteRef.current = true;
                onCityChange(details.city);
            }
            if (details.postalCode) {
                onPostalCodeChange(details.postalCode);
            }
            
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e: any) {
            console.error('Failed to get place details:', e);
        } finally {
            setPredictionsLoading(false);
        }
    }, [onAddressChange, onLocationChange, onCityChange, onPostalCodeChange]);

    const selectCity = useCallback((selectedCity: string) => {
        skipCityAutocompleteRef.current = true;
        onCityChange(selectedCity);
        setCityPredictions([]);
        setShowCityPredictions(false);

        const postal = FRENCH_CITIES_POSTAL[selectedCity.toLowerCase()];
        if (postal) {
            onPostalCodeChange(postal);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [onCityChange, onPostalCodeChange]);

    return (
        <View>
            <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Adresse</Text>
            <View
                style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    height: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingLeft: 12,
                    paddingRight: 6,
                    marginBottom: predictions.length > 0 ? 0 : 12,
                }}
            >
                <MagnifyingGlass size={18} color={textSecondary} />
                <TextInput
                    value={address}
                    onChangeText={onAddressChange}
                    placeholder="Rechercher une adresse..."
                    placeholderTextColor={textSecondary}
                    editable={editable}
                    style={{
                        flex: 1,
                        color: colors.textPrimary,
                        paddingHorizontal: 10,
                        paddingVertical: Platform.OS === 'ios' ? 12 : 10,
                    }}
                />
                <TouchableOpacity
                    onPress={onPressScanOCR}
                    style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Camera size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={onPressVoiceInput}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: voiceState === 'listening' ? colors.primary : 'transparent',
                        opacity: voiceState === 'processing' ? 0.7 : 1,
                    }}
                >
                    {voiceState === 'processing' ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <Microphone size={20} color={voiceState === 'listening' ? '#FFFFFF' : colors.textPrimary} />
                    )}
                </TouchableOpacity>
            </View>

            {voiceState === 'listening' && (
                <Text style={{ color: colors.primary, fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
                    🎤 Écoute en cours...
                </Text>
            )}

            {predictionsLoading && (
                <View style={{ paddingVertical: 12 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}

            {predictions.length > 0 && (
                <View style={{ backgroundColor: colors.background, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                    {predictions.slice(0, 5).map((p) => (
                        <TouchableOpacity
                            key={p.place_id}
                            onPress={() => selectPrediction(p)}
                            style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: textSecondary + '20' }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                                {p.structured_formatting?.main_text ?? p.description}
                            </Text>
                            <Text style={{ color: textSecondary, marginTop: 2 }}>
                                {p.structured_formatting?.secondary_text ?? ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                <View style={{ flex: 2 }}>
                    <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Ville</Text>
                    <TextInput
                        value={city}
                        onChangeText={onCityChange}
                        placeholder="Ville"
                        placeholderTextColor={textSecondary}
                        style={{
                            backgroundColor: colors.background,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: colors.textPrimary,
                        }}
                    />
                    {showCityPredictions && cityPredictions.length > 0 && (
                        <View style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: colors.surface,
                            borderRadius: 8,
                            marginTop: 4,
                            zIndex: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}>
                            {cityPredictions.map((c) => (
                                <TouchableOpacity
                                    key={c}
                                    onPress={() => selectCity(c)}
                                    style={{ paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                                >
                                    <Text style={{ color: colors.textPrimary }}>{c}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Code postal</Text>
                    <TextInput
                        value={postalCode}
                        onChangeText={onPostalCodeChange}
                        placeholder="69000"
                        placeholderTextColor={textSecondary}
                        keyboardType="number-pad"
                        maxLength={5}
                        style={{
                            backgroundColor: colors.background,
                            borderRadius: 12,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            color: colors.textPrimary,
                        }}
                    />
                </View>
            </View>

            <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Complément d'adresse</Text>
            <TextInput
                value={addressComplement}
                onChangeText={onAddressComplementChange}
                placeholder="Bât, villa, lotissement, digicode..."
                placeholderTextColor={textSecondary}
                multiline
                style={{
                    backgroundColor: colors.background,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    minHeight: 60,
                    color: colors.textPrimary,
                    marginBottom: 12,
                    textAlignVertical: 'top',
                }}
            />
        </View>
    );
}

export default AddressSection;
