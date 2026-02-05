/**
 * OCRScanner - Production-ready Frame Processor OCR
 * 
 * ARCHITECTURE:
 * Camera (720p video stream)
 * → Frame Processor (worklet, 5-7 FPS)
 * → scanText() in-memory OCR
 * → parseOCRText() on JS thread
 * → Stability check (2 frames)
 * → onDetected()
 * 
 * ZERO: takePhoto, setTimeout, setInterval, file I/O
 * TARGET: < 300ms detection latency
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    interpolateColor,
} from 'react-native-reanimated';
import {
    Camera,
    useCameraDevice,
    useCameraPermission,
    useCameraFormat,
    useFrameProcessor,
} from 'react-native-vision-camera';
import { useTextRecognition } from 'react-native-vision-camera-text-recognition';
import { Worklets } from 'react-native-worklets-core';
import * as Haptics from 'expo-haptics';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, Flashlight, Check, PencilSimple, Phone, MapPin, User, Buildings } from 'phosphor-react-native';
import {
    parseOCRText,
    hasValidAddress,
    areResultsSimilar,
    ParsedAddress as ParsedOCRData,
} from '../hooks/useOCRParsing';
import {
    useROITracker,
    ocrResultToTextBlocks,
    scaleROIToScreen,
    BoundingBox,
} from '../hooks/useROITracker';
import { logOCRTest } from '../services/ocrTestLogger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ROI (Region of Interest) - Fallback values for initial/no-detection state
const ROI_WIDTH = SCREEN_WIDTH * 0.9;
const ROI_HEIGHT = Math.round(SCREEN_HEIGHT * 0.3);
const ROI_TOP = Math.round(SCREEN_HEIGHT * 0.3);
const ROI_LEFT = (SCREEN_WIDTH - ROI_WIDTH) / 2;

// Dynamic ROI config
// Using react-native-vision-camera-text-recognition (ML Kit) which supports bounding boxes
const DYNAMIC_ROI_ENABLED = true;   // Toggle dynamic ROI
const ROI_DEBUG = __DEV__;          // Debug logging in dev mode
const ROI_SPRING_CONFIG = { damping: 15, stiffness: 150 };

// Performance tuning
const TARGET_FPS = 15;                 // Camera FPS (frame processor runs on each frame)
const STABILITY_THRESHOLD = 2;         // 2 similar results = validated
const MIN_TEXT_LENGTH = 15;            // Minimum chars to process
const DEBOUNCE_MS = 150;               // Debounce OCR calls

// ============================================================================
// TYPES
// ============================================================================

type ScannerState = 'ready' | 'processing' | 'validated';

type Props = {
    isVisible: boolean;
    onDetected: (data: ParsedOCRData) => void;
    onClose: () => void;
    /** Mode rafale: continue scanning after detection instead of closing */
    rapidMode?: boolean;
    /** Callback when an item is added in rapid mode */
    onRapidAdd?: (data: ParsedOCRData) => Promise<void>;
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function OCRScanner({ isVisible, onDetected, onClose, rapidMode = false, onRapidAdd }: Props) {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
    const cameraRef = useRef<Camera>(null);

    // State
    const [scannerState, setScannerState] = useState<ScannerState>('ready');
    const [zoom, setZoom] = useState(1.0);
    const [torch, setTorch] = useState<'off' | 'on'>('off');
    const [guidanceMessage, setGuidanceMessage] = useState('Visez une étiquette...');
    const [debugText, setDebugText] = useState<string>(''); // DEBUG: raw OCR text
    const [debugParsed, setDebugParsed] = useState<string>(''); // DEBUG: parsed result
    const [rapidScanCount, setRapidScanCount] = useState(0); // Counter for rapid mode
    const [rapidLastAddress, setRapidLastAddress] = useState<string>(''); // Last scanned address in rapid mode
    const [pendingData, setPendingData] = useState<ParsedOCRData | null>(null); // Pending data for confirmation
    const [isAdding, setIsAdding] = useState(false); // Loading state for add button

    // Editable fields for confirmation overlay
    const [editStreet, setEditStreet] = useState('');
    const [editPostalCode, setEditPostalCode] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editPhone, setEditPhone] = useState('');

    // Refs (no re-renders)
    const lastResultRef = useRef<ParsedOCRData | null>(null);
    const stabilityCountRef = useRef(0);
    const lastProcessTimeRef = useRef(0);
    const isValidatedRef = useRef(false);
    const rapidCooldownRef = useRef(false); // Prevent duplicate scans in rapid mode

    // Dynamic ROI Tracker
    const { updateROI, reset: resetROI } = useROITracker();
    const [dynamicROI, setDynamicROI] = useState<BoundingBox | null>(null);
    const [roiIsStable, setRoiIsStable] = useState(false);

    // OCR Plugin (ML Kit with bounding boxes)
    const { scanText } = useTextRecognition({ language: 'latin' });

    // Animated ROI values
    const roiX = useSharedValue(ROI_LEFT);
    const roiY = useSharedValue(ROI_TOP);
    const roiWidth = useSharedValue(ROI_WIDTH);
    const roiHeight = useSharedValue(ROI_HEIGHT);
    const roiStable = useSharedValue(0); // 0 = unstable, 1 = stable

    // Request permission on mount
    if (!hasPermission) {
        requestPermission();
    }

    // Camera format: 720p, 30fps for smooth preview
    const format = useCameraFormat(device, [
        { videoResolution: { width: 1280, height: 720 } },
        { fps: 30 },
    ]);

    // ========================================================================
    // OCR HANDLER (JS Thread)
    // ========================================================================
    const handleOCRResult = useCallback((text: string) => {
        // Skip if already validated
        if (isValidatedRef.current) return;

        // Debounce check
        const now = Date.now();
        if (now - lastProcessTimeRef.current < DEBOUNCE_MS) return;
        lastProcessTimeRef.current = now;

        // Log raw OCR text for debugging
        console.log('[OCR-RAW] ==================');
        console.log('[OCR-RAW] Text length:', text?.length || 0);
        console.log('[OCR-RAW] Content:', text);
        console.log('[OCR-RAW] ==================');

        // DEBUG: Show raw text on screen
        setDebugText(text?.substring(0, 500) || '');

        // Early exit: text too short
        if (!text || text.length < MIN_TEXT_LENGTH) {
            setGuidanceMessage('Rapprochez-vous...');
            return;
        }

        setScannerState('processing');
        setGuidanceMessage('Analyse...');

        // Parse OCR text
        const parsed = parseOCRText(text);

        // DEBUG: Show parsed result on screen
        setDebugParsed(
            `Rue: ${parsed.street || '-'}\n` +
            `CP: ${parsed.postalCode || '-'}\n` +
            `Ville: ${parsed.city || '-'}\n` +
            `Tél: ${parsed.phoneNumber || '-'}\n` +
            `Nom: ${parsed.firstName || ''} ${parsed.lastName || '-'}\n` +
            `Société: ${parsed.companyName || '-'}`
        );

        // Early exit: no valid address
        if (!hasValidAddress(parsed)) {
            lastResultRef.current = null;
            stabilityCountRef.current = 0;
            setGuidanceMessage('Adresse non détectée');
            setScannerState('ready');
            return;
        }

        // Stability check
        if (lastResultRef.current && areResultsSimilar(lastResultRef.current, parsed)) {
            stabilityCountRef.current += 1;
        } else {
            stabilityCountRef.current = 1;
        }
        lastResultRef.current = parsed;

        // Validated: 2 similar consecutive results
        if (stabilityCountRef.current >= STABILITY_THRESHOLD) {
            // Rapid mode: show confirmation overlay instead of auto-adding
            if (rapidMode && onRapidAdd) {
                // Prevent duplicate scans during cooldown
                if (rapidCooldownRef.current) return;
                rapidCooldownRef.current = true;

                setScannerState('validated');
                setGuidanceMessage('✓ Détecté! Vérifiez les infos');

                // Strong haptic feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Populate editable fields with parsed data
                setEditStreet(parsed.street || '');
                setEditPostalCode(parsed.postalCode || '');
                setEditCity(parsed.city || '');
                setEditFirstName(parsed.firstName || '');
                setEditLastName(parsed.lastName || '');
                setEditPhone(parsed.phoneNumber || '');

                // Show confirmation overlay
                setPendingData(parsed);
            } else {
                // Normal mode: close after detection
                isValidatedRef.current = true;
                setScannerState('validated');
                setGuidanceMessage('✓ Détecté!');

                // Haptic feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                // Callback
                onDetected(parsed);
            }
        } else {
            setGuidanceMessage('Confirmation...');
            setScannerState('ready');
        }
    }, [onDetected, rapidMode, onRapidAdd]);

    // Create worklet-compatible callback
    const handleOCRResultWorklet = Worklets.createRunOnJS(handleOCRResult);

    // ========================================================================
    // DYNAMIC ROI UPDATE HANDLER
    // ========================================================================
    const handleROIUpdate = useCallback((ocrResult: any, frameWidth: number, frameHeight: number) => {
        if (!DYNAMIC_ROI_ENABLED) return;

        const textBlocks = ocrResultToTextBlocks(ocrResult);

        if (ROI_DEBUG && textBlocks.length > 0) {
            console.log(`[ROI] Blocks: ${textBlocks.length}, Frame: ${frameWidth}x${frameHeight}, Screen: ${SCREEN_WIDTH}x${SCREEN_HEIGHT}`);
        }

        const roiState = updateROI(textBlocks, frameWidth, frameHeight);

        if (roiState.roi) {
            // Scale from frame coords to screen coords
            const screenROI = scaleROIToScreen(
                roiState.roi,
                frameWidth,
                frameHeight,
                SCREEN_WIDTH,
                SCREEN_HEIGHT,
                'portrait'
            );

            if (ROI_DEBUG) {
                console.log(`[ROI] Frame ROI: x=${Math.round(roiState.roi.x)}, y=${Math.round(roiState.roi.y)}, w=${Math.round(roiState.roi.width)}, h=${Math.round(roiState.roi.height)}`);
                console.log(`[ROI] Screen ROI: x=${screenROI.x}, y=${screenROI.y}, w=${screenROI.width}, h=${screenROI.height}, stable=${roiState.isStable}`);
            }

            setDynamicROI(screenROI);
            setRoiIsStable(roiState.isStable);

            // Update animated values with spring animation
            roiX.value = withSpring(screenROI.x, ROI_SPRING_CONFIG);
            roiY.value = withSpring(screenROI.y, ROI_SPRING_CONFIG);
            roiWidth.value = withSpring(screenROI.width, ROI_SPRING_CONFIG);
            roiHeight.value = withSpring(screenROI.height, ROI_SPRING_CONFIG);
            roiStable.value = withTiming(roiState.isStable ? 1 : 0, { duration: 200 });
        }
    }, [updateROI, roiX, roiY, roiWidth, roiHeight, roiStable]);

    const handleROIUpdateWorklet = Worklets.createRunOnJS(handleROIUpdate);

    // Debug logging for OCR results
    const logOCRDebug = useCallback((message: string) => {
        if (ROI_DEBUG) {
            console.log(message);
        }
    }, []);
    const logOCRDebugWorklet = Worklets.createRunOnJS(logOCRDebug);

    // ========================================================================
    // FRAME PROCESSOR (Worklet Thread - runs on every frame)
    // ========================================================================
    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';

        // Run ML Kit OCR on frame
        const results = scanText(frame);

        // ML Kit returns object: { resultText: string, blocks: [...] }
        if (results && typeof results === 'object') {
            const fullText = (results as any).resultText || '';
            const blocks = (results as any).blocks;

            if (ROI_DEBUG && fullText.length > 0) {
                logOCRDebugWorklet(`[OCR] Text: ${fullText.substring(0, 80)}...`);
                if (blocks) {
                    logOCRDebugWorklet(`[OCR] Blocks count: ${Array.isArray(blocks) ? blocks.length : 'N/A'}`);
                }
            }

            if (fullText.length > 0) {
                handleOCRResultWorklet(fullText);

                // Update dynamic ROI if enabled - pass the full result object
                if (DYNAMIC_ROI_ENABLED && blocks) {
                    handleROIUpdateWorklet(results, frame.width, frame.height);
                }
            }
        }
    }, [scanText, handleOCRResultWorklet, handleROIUpdateWorklet, logOCRDebugWorklet]);

    // ========================================================================
    // ANIMATED ROI STYLE
    // ========================================================================
    const animatedROIStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            left: roiX.value,
            top: roiY.value,
            width: roiWidth.value,
            height: roiHeight.value,
            borderWidth: 3,
            borderRadius: 12,
            borderColor: interpolateColor(
                roiStable.value,
                [0, 1],
                ['#FFAA00', '#00FF00']
            ),
        };
    });

    // ========================================================================
    // FOCUS (tap to focus)
    // ========================================================================
    const handleFocus = useCallback((x: number, y: number) => {
        if (cameraRef.current) {
            cameraRef.current.focus({ x, y });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, []);

    // ========================================================================
    // RESET on visibility change
    // ========================================================================
    React.useEffect(() => {
        if (isVisible) {
            // Reset state when scanner becomes visible
            lastResultRef.current = null;
            stabilityCountRef.current = 0;
            isValidatedRef.current = false;
            rapidCooldownRef.current = false;
            setScannerState('ready');
            setGuidanceMessage(rapidMode ? 'Mode rafale - Scannez les colis' : 'Visez une étiquette...');
            if (rapidMode) {
                setRapidScanCount(0);
                setRapidLastAddress('');
            }
            // Reset dynamic ROI
            resetROI();
            setDynamicROI(null);
            setRoiIsStable(false);
            // Reset to default position
            roiX.value = ROI_LEFT;
            roiY.value = ROI_TOP;
            roiWidth.value = ROI_WIDTH;
            roiHeight.value = ROI_HEIGHT;
            roiStable.value = 0;
        }
    }, [isVisible, rapidMode, resetROI, roiX, roiY, roiWidth, roiHeight, roiStable]);

    // ========================================================================
    // CONFIRMATION OVERLAY HANDLERS
    // ========================================================================
    const handleConfirmAdd = useCallback(async () => {
        if (!pendingData || !onRapidAdd) return;

        setIsAdding(true);

        // Create updated parsed data with edited fields
        const updatedData: ParsedOCRData = {
            ...pendingData,
            street: editStreet || pendingData.street,
            postalCode: editPostalCode || pendingData.postalCode,
            city: editCity || pendingData.city,
            firstName: editFirstName || pendingData.firstName,
            lastName: editLastName || pendingData.lastName,
            phoneNumber: editPhone || pendingData.phoneNumber,
            // Build full address
            fullAddress: [editStreet, editPostalCode, editCity].filter(Boolean).join(', ') || pendingData.fullAddress,
        };

        // Log the OCR test for later review
        logOCRTest(
            pendingData.rawText || '',
            {
                street: updatedData.street,
                postalCode: updatedData.postalCode,
                city: updatedData.city,
                firstName: updatedData.firstName,
                lastName: updatedData.lastName,
                phone: updatedData.phoneNumber,
            },
            true // Marked as confirmed by user
        ).catch(e => console.warn('[OCR-LOG] Failed:', e));

        try {
            await onRapidAdd(updatedData);
            setRapidScanCount(c => c + 1);
            setRapidLastAddress(updatedData.street || updatedData.postalCode || 'Adresse ajoutée');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('[RapidScan] Add failed:', error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } finally {
            setIsAdding(false);
            // Reset for next scan
            setPendingData(null);
            lastResultRef.current = null;
            stabilityCountRef.current = 0;
            rapidCooldownRef.current = false;
            setScannerState('ready');
            setGuidanceMessage('Prochain colis...');
        }
    }, [pendingData, onRapidAdd, editStreet, editPostalCode, editCity, editFirstName, editLastName, editPhone]);

    const handleDismissOverlay = useCallback(() => {
        // Cancel and continue scanning
        setPendingData(null);
        lastResultRef.current = null;
        stabilityCountRef.current = 0;
        rapidCooldownRef.current = false;
        setScannerState('ready');
        setGuidanceMessage('Annulé - Scannez à nouveau');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, []);

    // ========================================================================
    // RENDER
    // ========================================================================
    if (!hasPermission || !device) {
        return (
            <View style={styles.container}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.permissionText}>
                    Autorisation caméra requise
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Camera */}
            <Camera
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                device={device}
                format={format}
                isActive={isVisible && (!isValidatedRef.current || rapidMode)}
                zoom={zoom}
                torch={torch}
                enableZoomGesture
                fps={TARGET_FPS}
                frameProcessor={frameProcessor}
                pixelFormat="yuv"
                // Video mode only - NO photo
                photo={false}
                video={false}
                audio={false}
                onTouchEnd={(e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    handleFocus(locationX, locationY);
                }}
            />

            {/* Overlay with Dynamic ROI */}
            <View style={styles.overlay} pointerEvents="none">
                {/* Dark overlay */}
                <View style={StyleSheet.absoluteFill}>
                    <View style={[styles.darkArea, { flex: 1 }]} />
                </View>

                {/* Animated Dynamic ROI */}
                {DYNAMIC_ROI_ENABLED ? (
                    <Animated.View style={[animatedROIStyle, styles.dynamicRoi]}>
                        {/* Corner indicators */}
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                        {/* Stability indicator */}
                        {roiIsStable && (
                            <View style={styles.stableIndicator}>
                                <Text style={styles.stableText}>✓</Text>
                            </View>
                        )}
                    </Animated.View>
                ) : (
                    /* Fallback: Static ROI */
                    <>
                        <View style={[styles.darkArea, { height: ROI_TOP }]} />
                        <View style={styles.roiRow}>
                            <View style={[styles.darkArea, { width: ROI_LEFT }]} />
                            <View style={[
                                styles.roi,
                                {
                                    width: ROI_WIDTH,
                                    height: ROI_HEIGHT,
                                    borderColor: scannerState === 'validated' ? '#00FF00' :
                                        scannerState === 'processing' ? '#FFA500' : '#FFFFFF',
                                }
                            ]} />
                            <View style={[styles.darkArea, { width: ROI_LEFT }]} />
                        </View>
                        <View style={[styles.darkArea, { flex: 1 }]} />
                    </>
                )}
            </View>

            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={28} color="#FFFFFF" weight="bold" />
            </TouchableOpacity>

            {/* Torch toggle button */}
            <TouchableOpacity
                style={[styles.torchButton, torch === 'on' && styles.torchButtonActive]}
                onPress={() => {
                    setTorch(t => t === 'off' ? 'on' : 'off');
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
            >
                <Flashlight
                    size={28}
                    color={torch === 'on' ? '#FFD700' : '#FFFFFF'}
                    weight={torch === 'on' ? 'fill' : 'regular'}
                />
            </TouchableOpacity>

            {/* Guidance message */}
            <View style={styles.guidanceContainer}>
                <Text style={[
                    styles.guidanceText,
                    scannerState === 'validated' && styles.guidanceSuccess
                ]}>
                    {guidanceMessage}
                </Text>
            </View>

            {/* Rapid mode counter */}
            {rapidMode && (
                <View style={styles.rapidModeContainer}>
                    <View style={styles.rapidCounter}>
                        <Text style={styles.rapidCounterNumber}>{rapidScanCount}</Text>
                        <Text style={styles.rapidCounterLabel}>colis scannés</Text>
                    </View>
                    {rapidLastAddress && (
                        <Text style={styles.rapidLastAddress} numberOfLines={1}>
                            ✓ {rapidLastAddress}
                        </Text>
                    )}
                </View>
            )}

            {/* DEBUG: Raw OCR text overlay */}
            <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>🔍 RAW OCR:</Text>
                <Text style={styles.debugText} numberOfLines={4}>
                    {debugText || '(aucun texte)'}
                </Text>
                <Text style={[styles.debugTitle, { marginTop: 6 }]}>📝 PARSED:</Text>
                <Text style={[styles.debugText, { color: '#00FFFF' }]} numberOfLines={6}>
                    {debugParsed || '(rien extrait)'}
                </Text>
            </View>

            {/* Zoom controls */}
            <View style={styles.zoomControls}>
                <TouchableOpacity
                    style={styles.zoomButton}
                    onPress={() => setZoom(z => Math.max(1.0, z - 0.25))}
                >
                    <MagnifyingGlassMinus size={24} color="#FFFFFF" weight="bold" />
                </TouchableOpacity>
                <View style={styles.zoomIndicator}>
                    <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
                </View>
                <TouchableOpacity
                    style={styles.zoomButton}
                    onPress={() => setZoom(z => Math.min(device?.maxZoom ?? 5, z + 0.25))}
                >
                    <MagnifyingGlassPlus size={24} color="#FFFFFF" weight="bold" />
                </TouchableOpacity>
            </View>

            {/* Confirmation Overlay - Rapid Mode */}
            {pendingData && rapidMode && (
                <View style={styles.confirmationOverlay}>
                    <View style={styles.confirmationBackdrop} />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.confirmationContent}
                    >
                        <View style={styles.confirmationCard}>
                            {/* Header */}
                            <View style={styles.confirmationHeader}>
                                <Text style={styles.confirmationTitle}>📦 Vérifier le stop</Text>
                                <TouchableOpacity onPress={handleDismissOverlay} style={styles.confirmationClose}>
                                    <X size={24} color="#999" weight="bold" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.confirmationScroll} showsVerticalScrollIndicator={false}>
                                {/* Address Section */}
                                <View style={styles.fieldSection}>
                                    <View style={styles.fieldLabel}>
                                        <MapPin size={16} color="#FF6B00" weight="bold" />
                                        <Text style={styles.fieldLabelText}>Adresse</Text>
                                    </View>
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={editStreet}
                                        onChangeText={setEditStreet}
                                        placeholder="Numéro et rue"
                                        placeholderTextColor="#666"
                                    />
                                    <View style={styles.fieldRow}>
                                        <TextInput
                                            style={[styles.fieldInput, styles.fieldInputSmall]}
                                            value={editPostalCode}
                                            onChangeText={setEditPostalCode}
                                            placeholder="Code postal"
                                            placeholderTextColor="#666"
                                            keyboardType="number-pad"
                                            maxLength={5}
                                        />
                                        <TextInput
                                            style={[styles.fieldInput, styles.fieldInputLarge]}
                                            value={editCity}
                                            onChangeText={setEditCity}
                                            placeholder="Ville"
                                            placeholderTextColor="#666"
                                        />
                                    </View>
                                </View>

                                {/* Recipient Section */}
                                <View style={styles.fieldSection}>
                                    <View style={styles.fieldLabel}>
                                        <User size={16} color="#FF6B00" weight="bold" />
                                        <Text style={styles.fieldLabelText}>Destinataire</Text>
                                    </View>
                                    <View style={styles.fieldRow}>
                                        <TextInput
                                            style={[styles.fieldInput, styles.fieldInputHalf]}
                                            value={editFirstName}
                                            onChangeText={setEditFirstName}
                                            placeholder="Prénom"
                                            placeholderTextColor="#666"
                                            autoCapitalize="words"
                                        />
                                        <TextInput
                                            style={[styles.fieldInput, styles.fieldInputHalf]}
                                            value={editLastName}
                                            onChangeText={setEditLastName}
                                            placeholder="Nom"
                                            placeholderTextColor="#666"
                                            autoCapitalize="words"
                                        />
                                    </View>
                                </View>

                                {/* Phone Section */}
                                <View style={styles.fieldSection}>
                                    <View style={styles.fieldLabel}>
                                        <Phone size={16} color="#FF6B00" weight="bold" />
                                        <Text style={styles.fieldLabelText}>Téléphone</Text>
                                    </View>
                                    <TextInput
                                        style={styles.fieldInput}
                                        value={editPhone}
                                        onChangeText={setEditPhone}
                                        placeholder="+33 6 12 34 56 78"
                                        placeholderTextColor="#666"
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </ScrollView>

                            {/* Action Buttons */}
                            <View style={styles.confirmationActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={handleDismissOverlay}
                                    disabled={isAdding}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmButton, isAdding && styles.confirmButtonDisabled]}
                                    onPress={handleConfirmAdd}
                                    disabled={isAdding}
                                >
                                    {isAdding ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <Check size={20} color="#FFF" weight="bold" />
                                            <Text style={styles.confirmButtonText}>Ajouter</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            )}
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    darkArea: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    roiRow: {
        flexDirection: 'row',
    },
    roi: {
        borderWidth: 2,
        borderRadius: 12,
    },
    // Dynamic ROI styles
    dynamicRoi: {
        backgroundColor: 'transparent',
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderColor: '#00FF00',
    },
    cornerTL: {
        top: -2,
        left: -2,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 8,
    },
    cornerTR: {
        top: -2,
        right: -2,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 8,
    },
    cornerBL: {
        bottom: -2,
        left: -2,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 8,
    },
    cornerBR: {
        bottom: -2,
        right: -2,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 8,
    },
    stableIndicator: {
        position: 'absolute',
        top: -30,
        alignSelf: 'center',
        backgroundColor: '#00FF00',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    stableText: {
        color: '#000',
        fontSize: 14,
        fontWeight: 'bold',
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    torchButton: {
        position: 'absolute',
        top: 60,
        left: 20,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    torchButtonActive: {
        backgroundColor: 'rgba(255, 215, 0, 0.3)',
    },
    guidanceContainer: {
        position: 'absolute',
        top: ROI_TOP + ROI_HEIGHT + 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    guidanceText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        textAlign: 'center',
    },
    guidanceSuccess: {
        color: '#00FF00',
        fontWeight: 'bold',
    },
    permissionText: {
        color: '#FFFFFF',
        marginTop: 16,
        fontSize: 16,
    },
    zoomControls: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 30,
        padding: 4,
    },
    zoomButton: {
        padding: 12,
    },
    zoomIndicator: {
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    zoomText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    debugContainer: {
        position: 'absolute',
        bottom: 180,
        left: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        padding: 10,
        borderRadius: 8,
        maxHeight: 200,
    },
    debugTitle: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    debugText: {
        color: '#00FF00',
        fontSize: 10,
        fontFamily: 'Courier',
    },
    rapidModeContainer: {
        position: 'absolute',
        top: 120,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        minWidth: 100,
    },
    rapidCounter: {
        alignItems: 'center',
    },
    rapidCounterNumber: {
        color: '#00FF00',
        fontSize: 48,
        fontWeight: 'bold',
    },
    rapidCounterLabel: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 4,
    },
    rapidLastAddress: {
        color: '#00FF00',
        fontSize: 11,
        marginTop: 8,
        maxWidth: 120,
        textAlign: 'center',
    },
    // Confirmation Overlay Styles
    confirmationOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
    },
    confirmationBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
    },
    confirmationContent: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    confirmationCard: {
        backgroundColor: '#1A1A1A',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: SCREEN_HEIGHT * 0.7,
    },
    confirmationHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    confirmationTitle: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    confirmationClose: {
        padding: 8,
    },
    confirmationScroll: {
        maxHeight: SCREEN_HEIGHT * 0.4,
    },
    fieldSection: {
        marginBottom: 20,
    },
    fieldLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    fieldLabelText: {
        color: '#999',
        fontSize: 14,
        fontWeight: '600',
    },
    fieldInput: {
        backgroundColor: '#2A2A2A',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 16,
        marginBottom: 8,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 8,
    },
    fieldInputSmall: {
        flex: 1,
    },
    fieldInputLarge: {
        flex: 2,
    },
    fieldInputHalf: {
        flex: 1,
    },
    confirmationActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#333',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelButtonText: {
        color: '#999',
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        flex: 2,
        backgroundColor: '#FF6B00',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    confirmButtonDisabled: {
        opacity: 0.6,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
