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
    hasValidAddress,
    areResultsSimilar,
    ParsedAddress as ParsedOCRData,
} from '../hooks/useOCRParsing';
import { parseAsync, cancelAllJobs } from '../workers/parserWorker';
import {
    useSpokeROI,
    ocrResultToTextBlocks,
    scaleROIToScreen,
    getStaticROIScreen,
    BoundingBox,
} from '../hooks/useSpokeROI';
import { logOCRTest } from '../services/ocrTestLogger';
import { ocrLogger } from '../services/ocrLogger';
import { useAddressValidation, ValidationStatus } from '../hooks/useAddressValidation';

// Worker parsing state
let parsingInProgress = false;

// ============================================================================
// CONFIGURATION
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ROI UX - valeurs identiques à SEARCH_ROI_CONFIG dans useSpokeROI.ts
// Phase SEARCH: grande zone pour scanner large
const SEARCH_ROI_WIDTH = Math.round(SCREEN_WIDTH * 0.90);
const SEARCH_ROI_HEIGHT = Math.round(SCREEN_HEIGHT * 0.40);
const SEARCH_ROI_TOP = Math.round(SCREEN_HEIGHT * 0.30);
const SEARCH_ROI_LEFT = Math.round(SCREEN_WIDTH * 0.05);

// Dynamic ROI config
// Using react-native-vision-camera-text-recognition (ML Kit) which supports bounding boxes
const DYNAMIC_ROI_ENABLED = true;   // Toggle dynamic ROI
const ROI_DEBUG = __DEV__;          // Debug logging in dev mode
const ROI_SPRING_CONFIG = { damping: 15, stiffness: 150 };

// Performance tuning
const TARGET_FPS = 15;                 // Camera FPS (frame processor runs on each frame)
const STABILITY_THRESHOLD = 3;         // 3 similar results = validated (was 2)
const MIN_TEXT_LENGTH = 15;            // Minimum chars to process
const DEBOUNCE_MS = 150;               // Debounce OCR calls

// OPTIMIZATION: Production-grade settings
const FRAME_SKIP_INTERVAL = 3;         // Process 1 frame out of 3 (÷3 CPU)
const ROI_CONFIDENCE_THRESHOLD = 0.4;  // Min ROI confidence to trigger OCR (lowered for better detection)
const PARSE_CONFIDENCE_THRESHOLD = 0.75; // Min parsing confidence to accept
const FUZZY_MATCH_THRESHOLD = 0.70;    // Similarity threshold for stability (lowered for OCR variance)

// ============================================================================
// TYPES
// ============================================================================

type ScannerState = 'ready' | 'scanning' | 'validating' | 'validated' | 'error';

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
    const [exposure, setExposure] = useState(0); // -1 to 1, 0 = auto
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

    // NEW: Show edit overlay (Modifier Arrêt)
    const [showEditOverlay, setShowEditOverlay] = useState(false);

    // Refs (no re-renders)
    const lastResultRef = useRef<ParsedOCRData | null>(null);
    const stabilityCountRef = useRef(0);
    const lastProcessTimeRef = useRef(0);
    const isValidatedRef = useRef(false);
    const rapidCooldownRef = useRef(false); // Prevent duplicate scans in rapid mode

    // OPTIMIZATION: Frame skipping & Lazy OCR refs
    const frameCountRef = useRef(0);
    const roiConfidenceRef = useRef(0);
    const roiStableRef = useRef(false);
    const lastOCRTextRef = useRef<string>(''); // For memoization

    // PRIORITÉ 3: Autofocus - track last focus time to avoid spam
    const lastFocusTimeRef = useRef(0);
    const AUTOFOCUS_COOLDOWN_MS = 1500; // Focus max once per 1.5s

    // PRIORITÉ 1: ROI bounds for filtering (in frame coordinates)
    const roiFrameBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

    // Auto-exposure for faded labels
    const lowQualityFrameCount = useRef(0);
    const exposureBoostApplied = useRef(false);

    // Spoke-style ROI: ROI fixe UX + filtrage OCR + bounding box texte
    const { processOCR, setTapPoint, reset: resetROI } = useSpokeROI();

    // Hybrid OCR Workflow: Backend validation with debounce + cache
    const {
        status: validationStatus,
        rawText: validationRawText,
        localParsed: validationLocalParsed,
        validatedData,
        error: validationError,
        isNetworkError,
        updateLocalParsing,
        validateWithBackend,
        getBestAddress,
        getBestContact,
        acceptLocalParsing,
        reset: resetValidation,
    } = useAddressValidation();

    // Store last frame dimensions for tap->frame coordinate conversion
    const lastFrameDimensionsRef = useRef<{ width: number; height: number }>({ width: 1280, height: 720 });

    // ROI UX fixe (ne bouge jamais) - calculé une seule fois en screen coords
    const [staticROI] = useState<BoundingBox>(() => getStaticROIScreen(SCREEN_WIDTH, SCREEN_HEIGHT));
    // Bounding box du texte détecté (dynamique) - en screen coords  
    const [textBoundingBox, setTextBoundingBox] = useState<BoundingBox | null>(null);
    // Texte détecté dans le ROI
    const [roiHasText, setRoiHasText] = useState(false);

    // OCR Plugin (ML Kit with bounding boxes)
    const { scanText } = useTextRecognition({ language: 'latin' });

    // Animated ROI values
    const roiX = useSharedValue(SEARCH_ROI_LEFT);
    const roiY = useSharedValue(SEARCH_ROI_TOP);
    const roiWidth = useSharedValue(SEARCH_ROI_WIDTH);
    const roiHeight = useSharedValue(SEARCH_ROI_HEIGHT);
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
    // OCR HANDLER (JS Thread) - With Production Optimizations + Worker
    // ========================================================================
    const handleOCRResult = useCallback(async (text: string) => {
        // Skip if already validated
        if (isValidatedRef.current) return;

        // =====================================================================
        // PRIORITÉ 2: Skip if ROI is not stable (prevents processing while moving)
        // =====================================================================
        if (!roiStableRef.current) {
            return; // ROI not stable yet
        }

        // =====================================================================
        // OPTIMIZATION 6: Worker - Skip if parsing already in progress
        // =====================================================================
        if (parsingInProgress) {
            return; // Don't queue multiple parses
        }

        // =====================================================================
        // OPTIMIZATION 1: Frame Skipping - Process 1 frame out of N
        // =====================================================================
        frameCountRef.current++;
        if (frameCountRef.current % FRAME_SKIP_INTERVAL !== 0) {
            return; // Skip this frame
        }

        // =====================================================================
        // OPTIMIZATION 2: Lazy OCR - Skip only if no text detected at all
        // =====================================================================
        // Relaxed: Only skip if we have zero confidence (no text blocks at all)
        // The parsed result quality check later will filter bad results
        if (frameCountRef.current > 10 && roiConfidenceRef.current < 0.1) {
            setGuidanceMessage('Stabilisation...');
            return; // Skip - no text detected
        }

        // =====================================================================
        // OPTIMIZATION 3: Memoization - Skip if same text as last time
        // =====================================================================
        if (text === lastOCRTextRef.current) {
            return; // Same text, skip parsing
        }
        lastOCRTextRef.current = text;

        // Debounce check
        const now = Date.now();
        if (now - lastProcessTimeRef.current < DEBOUNCE_MS) return;
        lastProcessTimeRef.current = now;

        // DEBUG: Show raw text on screen
        setDebugText(text?.substring(0, 500) || '');

        // Early exit: text too short
        if (!text || text.length < MIN_TEXT_LENGTH) {
            setGuidanceMessage('Rapprochez-vous...');
            return;
        }

        setScannerState('scanning');
        setGuidanceMessage('Analyse locale...');

        // =====================================================================
        // OPTIMIZATION 6: Worker - Parse OCR text off UI thread
        // =====================================================================
        parsingInProgress = true;
        let parsed: ParsedOCRData;
        try {
            parsed = await parseAsync(text);
        } catch (error) {
            parsingInProgress = false;
            setScannerState('ready');
            return;
        }
        parsingInProgress = false;

        // Check if we got validated while parsing
        if (isValidatedRef.current) return;

        // =====================================================================
        // OPTIMIZATION 4: Confidence Gating - Reject low confidence results
        // =====================================================================
        if (parsed.confidence < PARSE_CONFIDENCE_THRESHOLD) {
            if (!isValidatedRef.current) {
                setGuidanceMessage(`Confiance faible (${Math.round(parsed.confidence * 100)}%)`);
                setScannerState('ready');

                // AUTO-EXPOSURE: Detect faded labels and boost exposure
                lowQualityFrameCount.current++;
                if (lowQualityFrameCount.current >= 8 && !exposureBoostApplied.current) {
                    // Many low quality frames - likely a faded label, boost exposure
                    exposureBoostApplied.current = true;
                    setExposure(0.5); // Increase brightness
                    setGuidanceMessage('📸 Contraste augmenté...');
                }
            }

            return; // Skip - parsing confidence too low
        }

        // Reset low quality counter on good result
        lowQualityFrameCount.current = 0;

        // DEBUG: Show parsed result on screen
        setDebugParsed(
            `Rue: ${parsed.street || '-'}\n` +
            `CP: ${parsed.postalCode || '-'}\n` +
            `Ville: ${parsed.city || '-'}\n` +
            `Tél: ${parsed.phoneNumber || '-'}\n` +
            `Nom: ${parsed.firstName || ''} ${parsed.lastName || '-'}\n` +
            `Société: ${parsed.companyName || '-'}\n` +
            `📊 Confiance: ${Math.round(parsed.confidence * 100)}%`
        );

        // Early exit: no valid address (but don't overwrite validated state)
        if (!hasValidAddress(parsed)) {
            lastResultRef.current = null;
            stabilityCountRef.current = 0;
            if (!isValidatedRef.current) {
                setGuidanceMessage('Adresse non détectée');
                setScannerState('ready');
            }
            return;
        }

        // =====================================================================
        // PHASE 1 (FLASH): Update local parsing immediately for live display
        // =====================================================================
        ocrLogger.logOCRDetection(text, text.split('\n').length);
        ocrLogger.logParsing(parsed);
        updateLocalParsing(text, parsed);

        // =====================================================================
        // TRIGGER BACKEND: Appel dès confiance >= 0.4 (pas de stabilisation)
        // =====================================================================
        const BACKEND_CONFIDENCE_THRESHOLD = 0.3;

        if (parsed.confidence >= BACKEND_CONFIDENCE_THRESHOLD) {
            // Prevent duplicate validations
            if (rapidCooldownRef.current) return;
            rapidCooldownRef.current = true;

            // =====================================================================
            // PHASE 2 (VALIDATION): Send to backend for Google Address Validation
            // =====================================================================
            ocrLogger.startWorkflow();
            setScannerState('validating');
            setGuidanceMessage('🔍 Validation en cours...');

            // Trigger backend validation (debounced + cached)
            validateWithBackend(text, parsed).then((validatedResponse) => {
                // Check if still validating (not reset)
                if (isValidatedRef.current) return;

                if (validatedResponse?.validation.is_valid) {
                    // =====================================================================
                    // PHASE 3 (SYNC): Update UI with validated data
                    // =====================================================================
                    isValidatedRef.current = true;
                    setScannerState('validated');
                    setGuidanceMessage('✓ Adresse validée!');

                    // Strong haptic feedback
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    ocrLogger.endWorkflow(true);

                    // Use validated data from backend
                    const finalData: ParsedOCRData = {
                        ...parsed,
                        street: validatedResponse.address.street || parsed.street,
                        postalCode: validatedResponse.address.postal_code || parsed.postalCode,
                        city: validatedResponse.address.city || parsed.city,
                        confidence: validatedResponse.validation.confidence,
                    };

                    if (rapidMode && onRapidAdd) {
                        // Populate editable fields
                        setEditStreet(finalData.street || '');
                        setEditPostalCode(finalData.postalCode || '');
                        setEditCity(finalData.city || '');
                        setEditFirstName(finalData.firstName || '');
                        setEditLastName(finalData.lastName || '');
                        setEditPhone(finalData.phoneNumber || '');
                        setPendingData(finalData);
                    } else {
                        // Log and callback
                        logOCRTest(text, {
                            street: finalData.street,
                            postalCode: finalData.postalCode,
                            city: finalData.city,
                            firstName: finalData.firstName,
                            lastName: finalData.lastName,
                            phone: finalData.phoneNumber,
                        }).catch(e => console.warn('[OCR-LOG] Failed:', e));
                        onDetected(finalData);
                    }
                } else {
                    // Backend validation failed or low confidence - show error state
                    // But only if we haven't already validated successfully
                    if (!isValidatedRef.current) {
                        ocrLogger.endWorkflow(false);
                        setScannerState('error');
                        setGuidanceMessage('⚠️ Validation échouée');
                        rapidCooldownRef.current = false;

                        // Allow manual fallback after 2 seconds
                        setTimeout(() => {
                            if (!isValidatedRef.current) {
                                setScannerState('ready');
                                setGuidanceMessage('Réessayez ou validez manuellement');
                            }
                        }, 2000);
                    }
                }
            }).catch(() => {
                // Network error - allow manual fallback
                // But only if we haven't already validated successfully
                if (!isValidatedRef.current) {
                    ocrLogger.endWorkflow(false);
                    setScannerState('error');
                    setGuidanceMessage('📶 Connexion impossible');
                    rapidCooldownRef.current = false;
                }
            });
        } else if (!isValidatedRef.current) {
            // Confiance trop basse, continuer à scanner (sauf si déjà validé)
            setGuidanceMessage(`Confiance: ${Math.round(parsed.confidence * 100)}% (min 30%)`);
        }
    }, [onDetected, rapidMode, onRapidAdd, updateLocalParsing, validateWithBackend]);

    // Create worklet-compatible callback
    const handleOCRResultWorklet = Worklets.createRunOnJS(handleOCRResult);

    // ========================================================================
    // SPOKE-STYLE OCR PROCESSING (ROI fixe + filtrage + textBox dynamique)
    // ========================================================================
    const handleSpokeOCR = useCallback((ocrResult: any, frameWidth: number, frameHeight: number) => {
        const textBlocks = ocrResultToTextBlocks(ocrResult);

        // Store frame dimensions for tap coordinate conversion
        lastFrameDimensionsRef.current = { width: frameWidth, height: frameHeight };

        // Process OCR avec l'architecture Spoke
        const result = processOCR(textBlocks, frameWidth, frameHeight);

        // ROI UX fixe est déjà calculé en screen coords (staticROI)
        // Pas de conversion nécessaire - il est FIXE

        // Mettre à jour la bounding box du texte (affichée SEULEMENT si texte stable)
        if (result.textBox) {
            const screenTextBox = scaleROIToScreen(
                result.textBox,  // Box calculée seulement quand texte stable
                frameWidth,
                frameHeight,
                SCREEN_WIDTH,
                SCREEN_HEIGHT
            );
            setTextBoundingBox(screenTextBox);
            setRoiHasText(true);

            // Indiquer visuellement si le texte est stable
            roiStable.value = withTiming(result.isTextStable ? 1 : 0.5, { duration: 200 });

            // Store ROI frame bounds for reference
            roiFrameBoundsRef.current = result.roi;
            roiConfidenceRef.current = result.filteredBlocks.length / Math.max(textBlocks.length, 1);
            roiStableRef.current = result.isTextStable;

            if (ROI_DEBUG) {
                console.log(`[SPOKE] ${result.filteredBlocks.length} blocks, stable=${result.isTextStable} (${result.stabilityCount}/4)`);
            }
        } else {
            setTextBoundingBox(null);
            setRoiHasText(false);
            roiStable.value = withTiming(0, { duration: 200 });
            roiStableRef.current = false;
        }

        // Autofocus at ROI center
        if (result.detected && cameraRef.current) {
            const now = Date.now();
            if (now - lastFocusTimeRef.current > AUTOFOCUS_COOLDOWN_MS) {
                lastFocusTimeRef.current = now;
                const focusX = staticROI.x + staticROI.width / 2;
                const focusY = staticROI.y + staticROI.height / 2;
                cameraRef.current.focus({ x: focusX, y: focusY }).catch(() => { });
            }
        }

        // Envoyer le texte filtré au parser
        if (result.filteredText.length > 0) {
            handleOCRResult(result.filteredText);
        }
    }, [processOCR, staticROI, roiStable, handleOCRResult]);

    const handleSpokeOCRWorklet = Worklets.createRunOnJS(handleSpokeOCR);

    // ========================================================================
    // FRAME PROCESSOR (Worklet Thread - runs on every frame)
    // ========================================================================
    const frameProcessor = useFrameProcessor((frame) => {
        'worklet';

        // Run ML Kit OCR on frame (OCR GLOBAL - sur toute l'image)
        const results = scanText(frame);

        // ML Kit returns object: { resultText: string, blocks: [...] }
        if (results && typeof results === 'object') {
            // Pass entire OCR result to Spoke handler (filtering happens on JS side)
            handleSpokeOCRWorklet(results, frame.width, frame.height);
        }
    }, [scanText, handleSpokeOCRWorklet]);

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
            borderColor: '#644117', // UPS Brown (secondary)
        };
    });

    // ========================================================================
    // TAP TO SELECT CLUSTER + FOCUS
    // ========================================================================
    const handleTapToMoveROI = useCallback((x: number, y: number) => {
        // Focus camera at tap point
        if (cameraRef.current) {
            cameraRef.current.focus({ x, y });
        }

        // Convert screen coordinates to frame coordinates
        // Frame is landscape (1280x720), screen is portrait
        const frameW = lastFrameDimensionsRef.current.width;
        const frameH = lastFrameDimensionsRef.current.height;

        // Screen to frame coordinate conversion (portrait screen, landscape frame)
        // In portrait mode with landscape frame, we need to rotate
        const scaleX = frameH / SCREEN_WIDTH;  // Frame height maps to screen width
        const scaleY = frameW / SCREEN_HEIGHT; // Frame width maps to screen height

        const frameX = y * scaleY;                    // Screen Y -> Frame X
        const frameY = (SCREEN_WIDTH - x) * scaleX;  // Screen X -> Frame Y (inverted)

        // Tell ROI tracker to prioritize blocks near this tap point
        setTapPoint(frameX, frameY);

        // Reset stability for new selection
        roiStable.value = 0;
        setRoiHasText(false);
        setTextBoundingBox(null);
        lastResultRef.current = null;
        stabilityCountRef.current = 0;

        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Update guidance
        setGuidanceMessage('Cluster sélectionné');
        setTimeout(() => {
            if (scannerState === 'ready') {
                setGuidanceMessage('Visez une étiquette...');
            }
        }, 1000);

        if (ROI_DEBUG) {
            console.log(`[TAP] Screen (${Math.round(x)}, ${Math.round(y)}) -> Frame (${Math.round(frameX)}, ${Math.round(frameY)})`);
        }
    }, [roiStable, scannerState, setTapPoint]);

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
            // Reset worker state
            frameCountRef.current = 0;
            roiConfidenceRef.current = 0;
            roiStableRef.current = false;
            lastOCRTextRef.current = '';
            parsingInProgress = false;
            cancelAllJobs(); // Cancel any pending parse jobs
            // Reset auto-exposure
            lowQualityFrameCount.current = 0;
            exposureBoostApplied.current = false;
            setExposure(0); // Reset to auto

            setScannerState('ready');
            setGuidanceMessage(rapidMode ? 'Mode rafale - Scannez les colis' : 'Visez une étiquette...');
            if (rapidMode) {
                setRapidScanCount(0);
                setRapidLastAddress('');
            }
            // Reset Spoke ROI (stabilisation uniquement, ROI UX reste fixe)
            resetROI();
            // Reset hybrid validation workflow
            resetValidation();
            setTextBoundingBox(null);
            setRoiHasText(false);
            roiStable.value = 0;
        } else {
            // Scanner closing - cancel pending jobs
            cancelAllJobs();
            parsingInProgress = false;
            resetValidation();
        }
    }, [isVisible, rapidMode, resetROI, resetValidation, roiStable]);

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
                isActive={isVisible}
                zoom={zoom}
                torch={torch}
                exposure={exposure}
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
                    handleTapToMoveROI(locationX, locationY);
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
                        {/* Text detected indicator */}
                        {roiHasText && (
                            <View style={styles.stableIndicator}>
                                <Text style={styles.stableText}>✓</Text>
                            </View>
                        )}
                    </Animated.View>
                ) : null}

                {/* Bounding box du texte détecté (rectangle vert dynamique) */}
                {textBoundingBox && (
                    <View
                        style={[
                            styles.textBoundingBox,
                            {
                                left: textBoundingBox.x,
                                top: textBoundingBox.y,
                                width: textBoundingBox.width,
                                height: textBoundingBox.height,
                            }
                        ]}
                    />
                )}

                {!DYNAMIC_ROI_ENABLED && (
                    /* Fallback: Static ROI */
                    <>
                        <View style={[styles.darkArea, { height: SEARCH_ROI_TOP }]} />
                        <View style={styles.roiRow}>
                            <View style={[styles.darkArea, { width: SEARCH_ROI_LEFT }]} />
                            <View style={[
                                styles.roi,
                                {
                                    width: SEARCH_ROI_WIDTH,
                                    height: SEARCH_ROI_HEIGHT,
                                    borderColor: scannerState === 'validated' ? '#00FF00' :
                                        (scannerState === 'scanning' || scannerState === 'validating') ? '#FFA500' : '#FFFFFF',
                                }
                            ]} />
                            <View style={[styles.darkArea, { width: SEARCH_ROI_LEFT }]} />
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

            {/* Result Overlay - Shown after backend validation */}
            {(validationStatus === 'validated' || validationStatus === 'error') && validationLocalParsed && !showEditOverlay && (
                <View style={styles.resultOverlay}>
                    <View style={styles.resultCard}>
                        {/* Status Badge */}
                        <View style={[
                            styles.resultStatusBadge,
                            validationStatus === 'validated' ? styles.resultStatusSuccess : styles.resultStatusError
                        ]}>
                            <Text style={styles.resultStatusText}>
                                {validationStatus === 'validated' ? '✓ Adresse validée' : '⚠️ Validation manuelle'}
                            </Text>
                        </View>

                        {/* Address Details */}
                        <View style={styles.resultDetails}>
                            <View style={styles.resultRow}>
                                <MapPin size={18} color="#FF6B00" weight="fill" />
                                <Text style={styles.resultText} numberOfLines={2}>
                                    {validationLocalParsed.street || 'Adresse non détectée'}
                                </Text>
                            </View>
                            <View style={styles.resultRow}>
                                <Buildings size={18} color="#FF6B00" weight="fill" />
                                <Text style={styles.resultText}>
                                    {validationLocalParsed.postalCode || ''} {validationLocalParsed.city || ''}
                                </Text>
                            </View>
                            {validationLocalParsed.phoneNumber && (
                                <View style={styles.resultRow}>
                                    <Phone size={18} color="#4CAF50" weight="fill" />
                                    <Text style={[styles.resultText, styles.resultPhone]}>
                                        {validationLocalParsed.phoneNumber}
                                    </Text>
                                </View>
                            )}
                            {(validationLocalParsed.firstName || validationLocalParsed.lastName) && (
                                <View style={styles.resultRow}>
                                    <User size={18} color="#666" weight="fill" />
                                    <Text style={styles.resultText}>
                                        {`${validationLocalParsed.firstName || ''} ${validationLocalParsed.lastName || ''}`.trim()}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.resultActions}>
                            <TouchableOpacity
                                style={styles.editButton}
                                onPress={() => {
                                    // Populate edit fields and show edit overlay
                                    setEditStreet(validationLocalParsed.street || '');
                                    setEditPostalCode(validationLocalParsed.postalCode || '');
                                    setEditCity(validationLocalParsed.city || '');
                                    setEditFirstName(validationLocalParsed.firstName || '');
                                    setEditLastName(validationLocalParsed.lastName || '');
                                    setEditPhone(validationLocalParsed.phoneNumber || '');
                                    setShowEditOverlay(true);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                            >
                                <PencilSimple size={20} color="#FFF" weight="bold" />
                                <Text style={styles.editButtonText}>Modifier</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.addButton}
                                disabled={isAdding}
                                onPress={() => {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                                    // Callback avec les données
                                    if (rapidMode && onRapidAdd) {
                                        setIsAdding(true);
                                        onRapidAdd(validationLocalParsed).then(() => {
                                            setRapidScanCount(c => c + 1);
                                            setRapidLastAddress(`${validationLocalParsed.street || ''}, ${validationLocalParsed.city || ''}`);
                                        }).finally(() => setIsAdding(false));
                                    } else {
                                        onDetected(validationLocalParsed);
                                    }

                                    // Reset pour scanner le prochain colis
                                    resetValidation();
                                    isValidatedRef.current = false;
                                    rapidCooldownRef.current = false;
                                    setScannerState('ready');
                                    setGuidanceMessage('Arrêt ajouté! Scannez le suivant...');
                                }}
                            >
                                {isAdding ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <Check size={20} color="#FFF" weight="bold" />
                                        <Text style={styles.addButtonText}>Ajouter Arrêt</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* DEBUG: Raw OCR text overlay - disabled by default, set to true to enable */}
            {false && __DEV__ && (
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
            )}

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

            {/* Edit Overlay - Modifier Arrêt */}
            {showEditOverlay && (
                <View style={styles.confirmationOverlay}>
                    <View style={styles.confirmationBackdrop} />
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.confirmationContent}
                    >
                        <View style={styles.confirmationCard}>
                            {/* Header */}
                            <View style={styles.confirmationHeader}>
                                <Text style={styles.confirmationTitle}>✏️ Modifier l'arrêt</Text>
                                <TouchableOpacity
                                    onPress={() => setShowEditOverlay(false)}
                                    style={styles.confirmationClose}
                                >
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
                                    onPress={() => setShowEditOverlay(false)}
                                    disabled={isAdding}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.confirmButton, isAdding && styles.confirmButtonDisabled]}
                                    onPress={() => {
                                        // Create edited data
                                        const editedData: ParsedOCRData = {
                                            street: editStreet,
                                            postalCode: editPostalCode,
                                            city: editCity,
                                            firstName: editFirstName,
                                            lastName: editLastName,
                                            phoneNumber: editPhone,
                                            companyName: '',
                                            addressAnnex: '',
                                            fullAddress: `${editStreet}, ${editPostalCode} ${editCity}`,
                                            confidence: 1.0,
                                        };

                                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                        setShowEditOverlay(false);

                                        if (rapidMode && onRapidAdd) {
                                            setIsAdding(true);
                                            onRapidAdd(editedData).then(() => {
                                                setRapidScanCount(c => c + 1);
                                                setRapidLastAddress(`${editStreet}, ${editCity}`);
                                                // Reset for next scan
                                                resetValidation();
                                                isValidatedRef.current = false;
                                                rapidCooldownRef.current = false;
                                                setScannerState('ready');
                                                setGuidanceMessage('Arrêt ajouté! Scannez le suivant...');
                                            }).finally(() => setIsAdding(false));
                                        } else {
                                            isValidatedRef.current = true;
                                            onDetected(editedData);
                                        }
                                    }}
                                    disabled={isAdding}
                                >
                                    {isAdding ? (
                                        <ActivityIndicator color="#FFF" size="small" />
                                    ) : (
                                        <>
                                            <Check size={20} color="#FFF" weight="bold" />
                                            <Text style={styles.confirmButtonText}>Confirmer</Text>
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
        borderColor: '#644117', // UPS Brown (secondary)
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
    textBoundingBox: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: '#FFB800', // Gold
        borderRadius: 4,
        backgroundColor: 'rgba(255, 184, 0, 0.15)', // Gold transparent
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
        top: SEARCH_ROI_TOP + SEARCH_ROI_HEIGHT + 20,
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
    // Live OCR Display Styles (Phase Flash)
    liveOcrContainer: {
        position: 'absolute',
        bottom: 320,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    liveOcrStatusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(100, 100, 100, 0.8)',
        marginBottom: 8,
    },
    liveOcrStatusValidated: {
        backgroundColor: 'rgba(0, 180, 0, 0.8)',
    },
    liveOcrStatusValidating: {
        backgroundColor: 'rgba(255, 165, 0, 0.8)',
    },
    liveOcrStatusError: {
        backgroundColor: 'rgba(220, 50, 50, 0.8)',
    },
    liveOcrStatusText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    liveOcrFields: {
        gap: 4,
    },
    liveOcrField: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 14,
    },
    liveOcrFieldValidated: {
        color: '#00FF00',
        fontWeight: '500',
    },
    liveOcrFieldPhone: {
        color: '#87CEEB',
    },
    manualFallbackButton: {
        marginTop: 10,
        backgroundColor: 'rgba(255, 107, 0, 0.9)',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    manualFallbackText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    // Result Overlay Styles (new workflow)
    resultOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: 40,
    },
    resultCard: {
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    resultStatusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 12,
    },
    resultStatusSuccess: {
        backgroundColor: 'rgba(76, 175, 80, 0.9)',
    },
    resultStatusError: {
        backgroundColor: 'rgba(255, 152, 0, 0.9)',
    },
    resultStatusText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    resultDetails: {
        gap: 10,
        marginBottom: 16,
    },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    resultText: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 15,
    },
    resultPhone: {
        color: '#4CAF50',
        fontWeight: '600',
    },
    resultActions: {
        flexDirection: 'row',
        gap: 12,
    },
    editButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#444',
        paddingVertical: 14,
        borderRadius: 12,
    },
    editButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    addButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FF6B00',
        paddingVertical: 14,
        borderRadius: 12,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
