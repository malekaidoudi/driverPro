import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
    ExpoSpeechRecognitionModule,
    useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { Camera, MagnifyingGlass, Microphone, PencilSimple, Trash } from 'phosphor-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { PlacePrediction, StopType, StopPriority } from '../types';
import { servicesApi } from '../services/api';
import OCRScanner from './OCRScannerOptimized';
import { ParsedAddress, parseOCRText, hasValidAddress } from '../hooks/useOCRParsing';

type ExistingStop = {
    address: string;
    latitude: number;
    longitude: number;
    order?: 'first' | 'auto' | 'last';
};

export type AddStopBottomSheetRef = {
    present: () => void;
    presentWithScanner: () => void; // Open with OCR scanner visible
    close: () => void;
    reset: () => void;
};

type StopOrder = 'first' | 'auto' | 'last';

// Helper pour extraire l'annexe d'adresse (villa, bât, etc.) d'une chaîne
function extractAnnexFromAddress(address: string): string | null {
    const annexPattern = /\b(villa|bât|bat|bâtiment|batiment|appt|apt|appartement|résidence|residence|rés|res|lot|lotissement|entrée|entree|ent|escalier|esc|étage|etage|porte|pte|bloc|tour|pavillon|pav|hameau|digicode|code|interphone)\s*[:\-]?\s*([A-Za-z0-9À-ÿ\-]+)/gi;
    const matches = [...address.matchAll(annexPattern)];
    if (matches.length === 0) return null;
    return [...new Set(matches.map(m => m[0].trim()))].join(', ');
}

export type StopPayload = {
    address: string;
    latitude: number;
    longitude: number;
    notes: string;
    packageCount: number;
    order: StopOrder;
    type: StopType;
    priority: StopPriority;
    durationMinutes: number;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    timeWindowStart?: string;
    timeWindowEnd?: string;
};

type AddStopBottomSheetProps = {
    title?: string;
    initialAddress?: string;
    initialLatitude?: number;
    initialLongitude?: number;
    initialNotes?: string;
    initialPackageCount?: number;
    initialOrder?: StopOrder;
    initialType?: StopType;
    initialPriority?: StopPriority;
    initialTimeWindowStart?: string;
    initialTimeWindowEnd?: string;
    initialDurationMinutes?: number;
    initialFirstName?: string;
    initialLastName?: string;
    initialPhoneNumber?: string;
    // Mode scan rapide: auto-ajout et mise à jour
    autoAddOnScan?: boolean;
    showActions?: boolean;
    existingStops?: ExistingStop[];

    onPressAdd?: (payload: StopPayload) => Promise<string | void> | string | void; // Returns stopId if auto-add
    onUpdateStop?: (stopId: string, payload: StopPayload) => Promise<void> | void;
    onPressChangeAddress?: () => void;
    onPressDuplicateStop?: () => Promise<void> | void;
    onPressDeleteStop?: () => Promise<void> | void;
    onDismissAfterScan?: () => void; // Called when sheet is dismissed after scan to reopen camera
};

export const AddStopBottomSheet = forwardRef<AddStopBottomSheetRef, AddStopBottomSheetProps>(function AddStopBottomSheet(
    {
        title = 'Ajouter un stop',
        initialAddress = '',
        initialLatitude = 0,
        initialLongitude = 0,
        initialNotes = '',
        initialPackageCount = 1,
        initialOrder = 'auto',
        initialType = StopType.DELIVERY,
        initialPriority = StopPriority.NORMAL,
        initialTimeWindowStart = '',
        initialTimeWindowEnd = '',
        initialDurationMinutes = 3,
        initialFirstName = '',
        initialLastName = '',
        initialPhoneNumber = '',
        showActions = false,
        autoAddOnScan = false,
        existingStops = [],
        onPressAdd,
        onUpdateStop,
        onPressChangeAddress,
        onPressDuplicateStop,
        onPressDeleteStop,
        onDismissAfterScan,
    },
    ref
) {
    const { colors } = useTheme();
    const modalRef = useRef<BottomSheetModal>(null);

    const snapPoints = useMemo(() => ['90%'], []);

    const [address, setAddress] = useState(initialAddress);
    const [latitude, setLatitude] = useState(initialLatitude);
    const [longitude, setLongitude] = useState(initialLongitude);
    const [notes, setNotes] = useState(initialNotes);
    const [packageCount, setPackageCount] = useState(initialPackageCount);
    const [order, setOrder] = useState<StopOrder>(initialOrder);
    const [type, setType] = useState<StopType>(initialType);
    const [priority, setPriority] = useState<StopPriority>(initialPriority);
    const [timeWindowStart, setTimeWindowStart] = useState(initialTimeWindowStart);
    const [timeWindowEnd, setTimeWindowEnd] = useState(initialTimeWindowEnd);
    const [durationMinutes, setDurationMinutes] = useState(initialDurationMinutes);
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);

    const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
    const [ocrScannerVisible, setOcrScannerVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Auto-add mode: track if stop was auto-added and needs update on dismiss
    const [autoAddedStopId, setAutoAddedStopId] = useState<string | null>(null);
    const scanModeRef = useRef(false); // Track if we came from OCR scan

    // Business opening hours (personnes morales)
    const [isCompany, setIsCompany] = useState(false);
    const [openingMorningStart, setOpeningMorningStart] = useState('09:00');
    const [openingMorningEnd, setOpeningMorningEnd] = useState('12:00');
    const [openingAfternoonStart, setOpeningAfternoonStart] = useState('13:30');
    const [openingAfternoonEnd, setOpeningAfternoonEnd] = useState('17:00');

    const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
    const [predictionsLoading, setPredictionsLoading] = useState(false);

    // Flag pour éviter l'autocomplete quand l'adresse vient de l'OCR/vocal
    const skipAutocompleteRef = useRef(false);
    // Flag pour savoir si on a un stop en attente d'ajout (adresse confirmée)
    const hasPendingStopRef = useRef(false);

    const resetForm = useCallback(() => {
        setAddress(initialAddress);
        setLatitude(initialLatitude);
        setLongitude(initialLongitude);
        setNotes(initialNotes);
        setPackageCount(initialPackageCount);
        setOrder(initialOrder);
        setType(initialType);
        setPriority(initialPriority);
        setTimeWindowStart(initialTimeWindowStart);
        setTimeWindowEnd(initialTimeWindowEnd);
        setDurationMinutes(initialDurationMinutes);
        setFirstName(initialFirstName);
        setLastName(initialLastName);
        setPhoneNumber(initialPhoneNumber);
        setPredictions([]);
        // Reset business hours
        setIsCompany(false);
        setOpeningMorningStart('09:00');
        setOpeningMorningEnd('12:00');
        setOpeningAfternoonStart('13:30');
        setOpeningAfternoonEnd('17:00');
    }, [initialAddress, initialLatitude, initialLongitude, initialNotes, initialPackageCount, initialOrder, initialType, initialPriority, initialTimeWindowStart, initialTimeWindowEnd, initialDurationMinutes, initialFirstName, initialLastName, initialPhoneNumber]);

    // Sync form state when initial values change (e.g., when editing a different stop)
    useEffect(() => {
        setAddress(initialAddress);
        setLatitude(initialLatitude);
        setLongitude(initialLongitude);
        setNotes(initialNotes);
        setPackageCount(initialPackageCount);
        setOrder(initialOrder);
        setType(initialType);
        setPriority(initialPriority);
        setTimeWindowStart(initialTimeWindowStart);
        setTimeWindowEnd(initialTimeWindowEnd);
        setDurationMinutes(initialDurationMinutes);
        setFirstName(initialFirstName);
        setLastName(initialLastName);
        setPhoneNumber(initialPhoneNumber);
    }, [initialAddress, initialLatitude, initialLongitude, initialNotes, initialPackageCount, initialOrder, initialType, initialPriority, initialTimeWindowStart, initialTimeWindowEnd, initialDurationMinutes, initialFirstName, initialLastName, initialPhoneNumber]);

    React.useImperativeHandle(
        ref,
        () => ({
            present: () => {
                resetForm();
                setOcrScannerVisible(false);
                modalRef.current?.present();
            },
            presentWithScanner: () => {
                resetForm();
                setOcrScannerVisible(true);
                scanModeRef.current = true;
                modalRef.current?.present();
            },
            close: () => modalRef.current?.dismiss(),
            reset: resetForm,
        }),
        [resetForm]
    );

    useEffect(() => {
        // Skip si l'adresse vient de l'OCR/vocal (flag temporaire)
        if (skipAutocompleteRef.current) {
            skipAutocompleteRef.current = false;
            setPredictions([]);
            return;
        }

        const q = address.trim();
        if (q.length < 3) {
            setPredictions([]);
            return;
        }

        // Ne pas chercher si on a déjà des coordonnées valides
        if (latitude !== 0 && longitude !== 0) {
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

    // Vérifie si l'adresse existe déjà dans la tournée
    const checkDuplicateAddress = useCallback((lat: number, lng: number): ExistingStop | null => {
        const threshold = 0.0001; // ~10m de tolérance
        return existingStops.find(stop =>
            Math.abs(stop.latitude - lat) < threshold &&
            Math.abs(stop.longitude - lng) < threshold
        ) || null;
    }, [existingStops]);

    // Détermine l'ordre pour un duplicata
    const getOrderForDuplicate = useCallback((existingOrder?: StopOrder): StopOrder => {
        if (existingOrder === 'first') return 'last';
        if (existingOrder === 'last') return 'first';
        return 'auto';
    }, []);

    const selectPrediction = useCallback(async (prediction: PlacePrediction) => {
        skipAutocompleteRef.current = true;
        setAddress(prediction.description);
        setPredictions([]);
        setPredictionsLoading(true);

        try {
            const details = await servicesApi.getPlaceDetails(prediction.place_id);
            setAddress(details.address);
            setLatitude(details.latitude);
            setLongitude(details.longitude);
            hasPendingStopRef.current = true;
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

            // Vérifier si l'adresse existe déjà
            const duplicate = checkDuplicateAddress(details.latitude, details.longitude);
            if (duplicate) {
                Alert.alert(
                    'Adresse existante',
                    'Cette adresse existe déjà dans la tournée. Voulez-vous créer un autre arrêt à cette adresse ?',
                    [
                        {
                            text: 'Annuler', style: 'cancel', onPress: () => {
                                setAddress('');
                                setLatitude(0);
                                setLongitude(0);
                                hasPendingStopRef.current = false;
                            }
                        },
                        {
                            text: 'Dupliquer', onPress: () => {
                                setOrder(getOrderForDuplicate(duplicate.order));
                            }
                        },
                    ]
                );
            }
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? "Impossible de récupérer les détails de l'adresse");
        } finally {
            setPredictionsLoading(false);
        }
    }, [checkDuplicateAddress, getOrderForDuplicate]);

    // Ajoute automatiquement le stop en attente
    const autoAddPendingStop = useCallback(async () => {
        if (!hasPendingStopRef.current || latitude === 0 || longitude === 0 || !address.trim()) {
            return false;
        }

        hasPendingStopRef.current = false;
        setSubmitting(true);
        try {
            await onPressAdd?.({
                address: address.trim(),
                latitude,
                longitude,
                notes: notes.trim(),
                packageCount,
                order,
                type,
                priority,
                durationMinutes,
                firstName: firstName.trim() || undefined,
                lastName: lastName.trim() || undefined,
                phoneNumber: phoneNumber.trim() || undefined,
                timeWindowStart: timeWindowStart.trim() || undefined,
                timeWindowEnd: timeWindowEnd.trim() || undefined,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Reset le formulaire pour le prochain stop
            setAddress('');
            setLatitude(0);
            setLongitude(0);
            setNotes('');
            setPackageCount(1);
            setOrder('auto');
            setType(StopType.DELIVERY);
            setDurationMinutes(3);
            setFirstName('');
            setLastName('');
            setPhoneNumber('');
            return true;
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Impossible de créer le stop');
            return false;
        } finally {
            setSubmitting(false);
        }
    }, [address, latitude, longitude, notes, packageCount, order, type, durationMinutes, firstName, lastName, phoneNumber, onPressAdd]);

    const onPressScanOCR = useCallback(async () => {
        // Auto-ajouter le stop en attente avant d'ouvrir le scanner
        await autoAddPendingStop();
        setOcrScannerVisible(true);
    }, [autoAddPendingStop]);

    const handleOCRDetected = useCallback(async (data: ParsedAddress) => {
        setOcrScannerVisible(false);
        skipAutocompleteRef.current = true;
        setPredictions([]);
        scanModeRef.current = true; // Mark that we came from OCR scan

        // Reset tous les champs pour un nouveau stop
        let newFirstName = '';
        let newLastName = '';
        let newPhoneNumber = '';
        let newNotes = '';
        const newPackageCount = 1;
        const newOrder: StopOrder = 'auto';
        const newType = StopType.DELIVERY;
        const newDurationMinutes = 3;

        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        setNotes('');
        setPackageCount(1);
        setOrder('auto');
        setType(StopType.DELIVERY);
        setDurationMinutes(3);

        // Build address from parsed fields or use fullAddress
        const ocrAddress = data.fullAddress || [data.street, data.postalCode, data.city].filter(Boolean).join(', ');
        let finalAddress = ocrAddress;
        let geocodedLat = 0;
        let geocodedLng = 0;

        if (ocrAddress) {
            setAddress(ocrAddress);

            // Geocode the detected address (only for coordinates, keep OCR address)
            try {
                const geocodeResult = await servicesApi.geocodeAddress(ocrAddress);
                if (geocodeResult.latitude && geocodeResult.longitude) {
                    geocodedLat = geocodeResult.latitude;
                    geocodedLng = geocodeResult.longitude;
                    setLatitude(geocodedLat);
                    setLongitude(geocodedLng);
                    hasPendingStopRef.current = true;
                    if (geocodeResult.formatted_address) {
                        finalAddress = geocodeResult.formatted_address;
                    }
                }
            } catch (e) {
                console.warn('Geocoding failed:', e);
            }
        }

        // Remplir les infos contact/société si détectées
        if (data.companyName) {
            newLastName = data.companyName;
            setFirstName('');
            setLastName(data.companyName);
            setIsCompany(true);
        } else {
            setIsCompany(false);
            if (data.firstName) {
                newFirstName = data.firstName;
                setFirstName(data.firstName);
            }
            if (data.lastName) {
                newLastName = data.lastName;
                setLastName(data.lastName);
            }
        }
        if (data.phoneNumber) {
            newPhoneNumber = data.phoneNumber;
            setPhoneNumber(data.phoneNumber);
        }

        // Notes = annexe d'adresse
        const annex = data.addressAnnex
            ?? extractAnnexFromAddress(finalAddress)
            ?? extractAnnexFromAddress(ocrAddress);
        if (annex) {
            newNotes = annex;
            setNotes(annex);
        }

        // Auto-add mode: add the stop immediately
        if (autoAddOnScan && geocodedLat !== 0 && geocodedLng !== 0 && onPressAdd) {
            try {
                const payload: StopPayload = {
                    address: finalAddress,
                    latitude: geocodedLat,
                    longitude: geocodedLng,
                    notes: newNotes,
                    packageCount: newPackageCount,
                    order: newOrder,
                    type: newType,
                    priority: StopPriority.NORMAL,
                    durationMinutes: newDurationMinutes,
                    firstName: newFirstName || undefined,
                    lastName: newLastName || undefined,
                    phoneNumber: newPhoneNumber || undefined,
                };
                const result = await onPressAdd(payload);
                if (typeof result === 'string') {
                    setAutoAddedStopId(result);
                }
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {
                console.error('[OCR] Auto-add failed:', e);
            }
        }
    }, [autoAddOnScan, onPressAdd]);

    const handleOCRClose = useCallback(() => {
        setOcrScannerVisible(false);
    }, []);

    useSpeechRecognitionEvent('start', () => {
        setVoiceState('listening');
    });

    useSpeechRecognitionEvent('end', () => {
        setVoiceState('idle');
    });

    useSpeechRecognitionEvent('result', async (event) => {
        const transcript = event.results[0]?.transcript;
        if (!transcript) return;

        // Parse voice input like OCR
        const parsed = parseOCRText(transcript);
        console.log('[VOICE] Parsed:', parsed);

        // Reset fields for new input
        skipAutocompleteRef.current = true;
        setPredictions([]);
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        setNotes('');

        // Fill form with parsed data (company or individual)
        if (parsed.companyName) {
            // Personne morale: mettre le nom de société dans lastName + activer horaires
            setLastName(parsed.companyName);
            setIsCompany(true);
            console.log('[VOICE] Company detected:', parsed.companyName);
        } else {
            // Personne physique: prénom + nom
            setIsCompany(false);
            if (parsed.firstName) setFirstName(parsed.firstName);
            if (parsed.lastName) setLastName(parsed.lastName);
        }
        if (parsed.phoneNumber) setPhoneNumber(parsed.phoneNumber);
        if (parsed.addressAnnex) setNotes(parsed.addressAnnex);

        // Build address from parsed fields
        const voiceAddress = parsed.fullAddress || [parsed.street, parsed.postalCode, parsed.city].filter(Boolean).join(', ');

        // Set address and geocode
        if (voiceAddress) {
            setAddress(voiceAddress);
            setLatitude(0);
            setLongitude(0);

            // Geocode the parsed address
            try {
                const geocodeResult = await servicesApi.geocodeAddress(voiceAddress);
                if (geocodeResult.latitude && geocodeResult.longitude) {
                    setLatitude(geocodeResult.latitude);
                    setLongitude(geocodeResult.longitude);
                    hasPendingStopRef.current = true;
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
            } catch (e) {
                console.warn('[VOICE] Geocoding failed:', e);
            }
        } else {
            // Fallback: use raw transcript as address
            setAddress(transcript);
            setLatitude(0);
            setLongitude(0);
        }
    });

    useSpeechRecognitionEvent('error', (event) => {
        setVoiceState('idle');
        Alert.alert('Erreur dictée', event.error ?? 'Erreur de reconnaissance vocale');
    });

    const onPressVoiceInput = useCallback(async () => {
        if (voiceState === 'listening') {
            ExpoSpeechRecognitionModule.stop();
            setVoiceState('idle'); // Force reset state immediately
            setPredictionsLoading(false); // Clear any loading state
            return;
        }

        if (voiceState !== 'idle') {
            // Force reset if stuck in an unexpected state
            setVoiceState('idle');
            setPredictionsLoading(false);
            return;
        }

        // Auto-ajouter le stop en attente avant de démarrer la dictée
        await autoAddPendingStop();

        try {
            const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
            if (!result.granted) {
                Alert.alert('Permission requise', 'Autorise le micro pour dicter une adresse');
                return;
            }

            ExpoSpeechRecognitionModule.start({
                lang: 'fr-FR',
                interimResults: true,
                maxAlternatives: 3,
                continuous: true,
                requiresOnDeviceRecognition: false,
                addsPunctuation: true,
            });
        } catch (e: any) {
            Alert.alert('Erreur', e?.message ?? 'Impossible de démarrer la dictée');
            setVoiceState('idle');
        }
    }, [voiceState, autoAddPendingStop]);

    // Quand l'utilisateur commence à taper une nouvelle adresse
    const handleAddressChange = useCallback(async (text: string) => {
        // Si on avait une adresse confirmée et l'utilisateur modifie, auto-add d'abord
        if (hasPendingStopRef.current && latitude !== 0 && longitude !== 0) {
            await autoAddPendingStop();
        }
        setAddress(text);
        setLatitude(0);
        setLongitude(0);
    }, [latitude, longitude, autoAddPendingStop]);

    // Modifier l'adresse actuelle (annuler la confirmation)
    const handleModifyAddress = useCallback(() => {
        hasPendingStopRef.current = false;
        setLatitude(0);
        setLongitude(0);
        // Garder l'adresse texte pour permettre la modification
    }, []);

    // Supprimer l'adresse actuelle
    const handleDeleteAddress = useCallback(() => {
        hasPendingStopRef.current = false;
        setAddress('');
        setLatitude(0);
        setLongitude(0);
        setNotes('');
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    const textSecondary = colors.textSecondary;

    // Handle sheet dismiss: update stop if auto-added, then reopen camera
    const handleSheetChange = useCallback(async (index: number) => {
        if (index === -1) { // Sheet dismissed
            const shouldReopenScanner = scanModeRef.current && onDismissAfterScan;
            const stopIdToUpdate = autoAddedStopId;

            // Reset state immediately to avoid stale closures
            setAutoAddedStopId(null);
            scanModeRef.current = false;

            // Update the auto-added stop with any changes (fire and forget)
            if (stopIdToUpdate && onUpdateStop) {
                Promise.resolve(onUpdateStop(stopIdToUpdate, {
                    address: address.trim(),
                    latitude,
                    longitude,
                    notes: notes.trim(),
                    packageCount,
                    order,
                    type,
                    priority,
                    durationMinutes,
                    firstName: firstName.trim() || undefined,
                    lastName: lastName.trim() || undefined,
                    phoneNumber: phoneNumber.trim() || undefined,
                    timeWindowStart: timeWindowStart.trim() || undefined,
                    timeWindowEnd: timeWindowEnd.trim() || undefined,
                })).catch((e: unknown) => {
                    console.warn('[AddStop] Update failed (stop was already added):', e);
                });
            }

            // Reopen camera for next scan
            if (shouldReopenScanner) {
                onDismissAfterScan();
            }
        }
    }, [autoAddedStopId, onUpdateStop, onDismissAfterScan, address, latitude, longitude, notes, packageCount, order, type, priority, durationMinutes, firstName, lastName, phoneNumber, timeWindowStart, timeWindowEnd]);

    return (
        <BottomSheetModal
            ref={modalRef}
            snapPoints={snapPoints}
            enablePanDownToClose
            backgroundStyle={{ backgroundColor: colors.surface }}
            handleIndicatorStyle={{ backgroundColor: colors.textSecondary }}
            onChange={handleSheetChange}
        >
            <BottomSheetScrollView
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: 40,
                }}
                keyboardShouldPersistTaps="handled"
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
                        {title}
                    </Text>
                    {autoAddedStopId && (
                        <View style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ color: '#351C15', fontSize: 12, fontWeight: '700' }}>Ajouté</Text>
                        </View>
                    )}
                </View>

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
                        onChangeText={handleAddressChange}
                        placeholder="Ajouter ou trouver des arrêts"
                        placeholderTextColor={textSecondary}
                        editable={autoAddedStopId !== null || latitude === 0 || longitude === 0}
                        style={{
                            flex: 1,
                            color: colors.textPrimary,
                            paddingHorizontal: 10,
                            paddingVertical: Platform.OS === 'ios' ? 12 : 10,
                        }}
                    />

                    <TouchableOpacity
                        onPress={onPressScanOCR}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
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
                        🎤 Écoute en cours... Appuie à nouveau pour arrêter
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
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Prénom</Text>
                        <TextInput
                            value={firstName}
                            onChangeText={setFirstName}
                            placeholder="Prénom"
                            placeholderTextColor={textSecondary}
                            style={{
                                backgroundColor: colors.background,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                color: colors.textPrimary,
                            }}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Nom</Text>
                        <TextInput
                            value={lastName}
                            onChangeText={setLastName}
                            placeholder="Nom"
                            placeholderTextColor={textSecondary}
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

                <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Téléphone</Text>
                <TextInput
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="+33 6 12 34 56 78"
                    placeholderTextColor={textSecondary}
                    keyboardType="phone-pad"
                    style={{
                        backgroundColor: colors.background,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        color: colors.textPrimary,
                        marginBottom: 12,
                    }}
                />

                {/* Horaires d'ouverture pour les personnes morales */}
                {isCompany && (
                    <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                                🏢 Horaires d'ouverture
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsCompany(false)}
                                style={{ marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4 }}
                            >
                                <Text style={{ color: textSecondary, fontSize: 11 }}>✕ Particulier</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: textSecondary, fontSize: 11, marginBottom: 4 }}>Matin</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <TextInput
                                        value={openingMorningStart}
                                        onChangeText={setOpeningMorningStart}
                                        placeholder="09:00"
                                        placeholderTextColor={textSecondary}
                                        style={{
                                            flex: 1,
                                            backgroundColor: colors.background,
                                            borderRadius: 8,
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            color: colors.textPrimary,
                                            fontSize: 13,
                                            textAlign: 'center',
                                        }}
                                    />
                                    <Text style={{ color: textSecondary }}>-</Text>
                                    <TextInput
                                        value={openingMorningEnd}
                                        onChangeText={setOpeningMorningEnd}
                                        placeholder="12:00"
                                        placeholderTextColor={textSecondary}
                                        style={{
                                            flex: 1,
                                            backgroundColor: colors.background,
                                            borderRadius: 8,
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            color: colors.textPrimary,
                                            fontSize: 13,
                                            textAlign: 'center',
                                        }}
                                    />
                                </View>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: textSecondary, fontSize: 11, marginBottom: 4 }}>Après-midi</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <TextInput
                                        value={openingAfternoonStart}
                                        onChangeText={setOpeningAfternoonStart}
                                        placeholder="13:30"
                                        placeholderTextColor={textSecondary}
                                        style={{
                                            flex: 1,
                                            backgroundColor: colors.background,
                                            borderRadius: 8,
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            color: colors.textPrimary,
                                            fontSize: 13,
                                            textAlign: 'center',
                                        }}
                                    />
                                    <Text style={{ color: textSecondary }}>-</Text>
                                    <TextInput
                                        value={openingAfternoonEnd}
                                        onChangeText={setOpeningAfternoonEnd}
                                        placeholder="17:00"
                                        placeholderTextColor={textSecondary}
                                        style={{
                                            flex: 1,
                                            backgroundColor: colors.background,
                                            borderRadius: 8,
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            color: colors.textPrimary,
                                            fontSize: 13,
                                            textAlign: 'center',
                                        }}
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Complément d'adresse</Text>
                <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Bât, villa, lotissement, digicode..."
                    placeholderTextColor={textSecondary}
                    multiline
                    style={{
                        backgroundColor: colors.background,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        minHeight: 70,
                        color: colors.textPrimary,
                        marginBottom: 12,
                        textAlignVertical: 'top',
                    }}
                />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Colis</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                            onPress={() => setPackageCount((p) => Math.max(0, p - 1))}
                            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>-</Text>
                        </TouchableOpacity>
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', minWidth: 24, textAlign: 'center' }}>{packageCount}</Text>
                        <TouchableOpacity
                            onPress={() => setPackageCount((p) => p + 1)}
                            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Ordre</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 }}>
                        {(
                            [
                                { key: 'first', label: 'Premier' },
                                { key: 'auto', label: 'Auto' },
                                { key: 'last', label: 'Dernier' },
                            ] as const
                        ).map((it) => (
                            <TouchableOpacity
                                key={it.key}
                                onPress={() => setOrder(it.key)}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 12,
                                    borderRadius: 10,
                                    backgroundColor: order === it.key ? colors.primary : 'transparent',
                                }}
                            >
                                <Text style={{ color: order === it.key ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>{it.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Type</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 }}>
                        <TouchableOpacity
                            onPress={() => setType(StopType.DELIVERY)}
                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: type === StopType.DELIVERY ? colors.primary : 'transparent' }}
                        >
                            <Text style={{ color: type === StopType.DELIVERY ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Livraison</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setType(StopType.COLLECTION)}
                            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: type === StopType.COLLECTION ? colors.primary : 'transparent' }}
                        >
                            <Text style={{ color: type === StopType.COLLECTION ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Collecte</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Priority selector */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Priorité</Text>
                    <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderRadius: 12, padding: 4 }}>
                        {([
                            { key: StopPriority.NORMAL, label: '🟢 Normal', color: '#22C55E' },
                            { key: StopPriority.HIGH, label: '🟠 Haute', color: '#F59E0B' },
                            { key: StopPriority.URGENT, label: '🔴 Urgent', color: '#EF4444' },
                        ] as const).map((it) => (
                            <TouchableOpacity
                                key={it.key}
                                onPress={() => setPriority(it.key)}
                                style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 10,
                                    borderRadius: 10,
                                    backgroundColor: priority === it.key ? it.color : 'transparent',
                                }}
                            >
                                <Text style={{ color: priority === it.key ? '#FFFFFF' : colors.textPrimary, fontWeight: '800', fontSize: 11 }}>{it.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Time window */}
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ color: textSecondary, fontSize: 12, marginBottom: 6 }}>Créneau horaire (optionnel)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                            value={timeWindowStart}
                            onChangeText={setTimeWindowStart}
                            placeholder="08:00"
                            placeholderTextColor={textSecondary}
                            keyboardType="numbers-and-punctuation"
                            style={{
                                flex: 1,
                                backgroundColor: colors.background,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                color: colors.textPrimary,
                                textAlign: 'center',
                            }}
                        />
                        <Text style={{ color: textSecondary }}>→</Text>
                        <TextInput
                            value={timeWindowEnd}
                            onChangeText={setTimeWindowEnd}
                            placeholder="12:00"
                            placeholderTextColor={textSecondary}
                            keyboardType="numbers-and-punctuation"
                            style={{
                                flex: 1,
                                backgroundColor: colors.background,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                color: colors.textPrimary,
                                textAlign: 'center',
                            }}
                        />
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Durée d'arrêt estimée</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TouchableOpacity
                            onPress={() => setDurationMinutes((p) => Math.max(0, p - 1))}
                            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>-</Text>
                        </TouchableOpacity>
                        <Text style={{ color: colors.textPrimary, fontWeight: '800', minWidth: 56, textAlign: 'center' }}>{durationMinutes} min</Text>
                        <TouchableOpacity
                            onPress={() => setDurationMinutes((p) => p + 1)}
                            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>+</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Info sur l'ajout automatique */}
                {latitude !== 0 && longitude !== 0 && (
                    <View style={{ backgroundColor: colors.primary + '15', borderRadius: 12, padding: 12, marginBottom: showActions ? 16 : 0 }}>
                        <Text style={{ color: colors.primary, fontSize: 12, textAlign: 'center' }}>
                            {submitting ? '⏳ Ajout en cours...' : '✓ L\'arrêt sera ajouté automatiquement quand vous scannerez ou dicterez une nouvelle adresse'}
                        </Text>
                    </View>
                )}

                {/* Action Buttons - Always visible */}
                <View style={{ marginTop: 20, gap: 10 }}>
                    <TouchableOpacity
                        onPress={onPressChangeAddress}
                        style={{
                            backgroundColor: colors.surface,
                            padding: 14,
                            borderRadius: 12,
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'left' }}>Modifier l'arrêt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onPressDuplicateStop}
                        style={{
                            backgroundColor: colors.surface,
                            padding: 14,
                            borderRadius: 12,
                        }}
                    >
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'left' }}>Dupliquer l'arrêt</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert('Supprimer', 'Supprimer cet arrêt ?', [
                                { text: 'Annuler', style: 'cancel' },
                                {
                                    text: 'Supprimer',
                                    style: 'destructive',
                                    onPress: () => onPressDeleteStop?.(),
                                },
                            ]);
                        }}
                        style={{
                            backgroundColor: 'transparent',
                            padding: 14,
                            borderRadius: 12,
                        }}
                    >
                        <Text style={{ color: '#DC2626', fontSize: 14, fontWeight: '700', textAlign: 'left' }}>Supprimer l'arrêt </Text>
                    </TouchableOpacity>
                </View>
            </BottomSheetScrollView>

            {/* OCR Scanner Modal */}
            <Modal
                visible={ocrScannerVisible}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={handleOCRClose}
            >
                <OCRScanner
                    isVisible={ocrScannerVisible}
                    onDetected={handleOCRDetected}
                    onClose={handleOCRClose}
                />
            </Modal>
        </BottomSheetModal>
    );
});
