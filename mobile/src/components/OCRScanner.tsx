import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Camera,
    useCameraDevice,
    useCameraFormat,
    useCameraPermission,
} from 'react-native-vision-camera';
import TextRecognitionMLKit from '@react-native-ml-kit/text-recognition';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus } from 'phosphor-react-native';
import { parseOCRText, hasValidAddress, areResultsSimilar, ParsedOCRData } from '../hooks/useOCRParsing';
import { useTheme } from '../contexts/ThemeContext';

// --- CONFIGURATION ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ROI_WIDTH = SCREEN_WIDTH * 0.9;
const ROI_HEIGHT = Math.round(SCREEN_HEIGHT * 0.3);
const ROI_TOP = Math.round(SCREEN_HEIGHT * 0.3);
const ROI_LEFT = (SCREEN_WIDTH - ROI_WIDTH) / 2;

// Auto-capture toutes les X ms quand la caméra est active
const AUTO_CAPTURE_INTERVAL_MS = 1200;
const RETRY_DELAY_MS = 1000;
const DEFAULT_ZOOM = 1.0;
const STABILITY_THRESHOLD = 2; // Nombre de détections similaires pour valider

// --- TYPES ---
type ScannerState = 'scanning' | 'analyzing' | 'error';

// --- COMPOSANT ---
const OCRScanner = ({ onDetected, onClose, isVisible }: { onDetected: (data: ParsedOCRData) => void; onClose: () => void; isVisible: boolean }) => {
    const { colors } = useTheme();
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
    const cameraRef = useRef<Camera>(null);

    // Format caméra optimisé pour photo OCR (iOS safe)
    const format = useCameraFormat(device, [
        { photoResolution: 'max' },
        { videoResolution: 'max' },
        { fps: 30 },
    ]);

    // State
    const [scannerState, setScannerState] = useState<ScannerState>('scanning');
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [guidanceMessage, setGuidanceMessage] = useState('Visez une étiquette...');
    const [attemptCount, setAttemptCount] = useState(0);

    // Refs pour éviter les captures multiples
    const isCapturingRef = useRef(false);
    const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Stabilité: même résultat 2x de suite = on valide
    const lastResultRef = useRef<ParsedOCRData | null>(null);
    const stabilityCountRef = useRef(0);

    // --- PERMISSION ---
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    // --- CAPTURE ET OCR (ML Kit sur photo) ---
    const captureAndAnalyze = useCallback(async () => {
        if (isCapturingRef.current || !cameraRef.current || scannerState !== 'scanning') {
            return;
        }

        isCapturingRef.current = true;
        setScannerState('analyzing');
        setGuidanceMessage('Analyse en cours...');

        try {
            // Laisser iOS stabiliser la session avant capture
            await new Promise(res => setTimeout(res, 100));

            // Capture photo (iOS safe options)
            const photo = await cameraRef.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            const imagePath = `file://${photo.path}`;
            console.log(`[OCR] 📸 Photo captured, analyzing...`);

            // OCR ML Kit (fiable sur photo)
            const result = await TextRecognitionMLKit.recognize(imagePath);
            const textLen = result.text?.length ?? 0;
            console.log(`[OCR] 📝 ML Kit result: ${textLen} chars`);

            if (result.text && textLen > 10) {
                const parsed = parseOCRText(result.text);

                if (hasValidAddress(parsed)) {
                    // Vérifier la stabilité: même résultat que précédemment?
                    if (lastResultRef.current && areResultsSimilar(lastResultRef.current, parsed)) {
                        stabilityCountRef.current += 1;
                        console.log(`[OCR] 🔄 Stable detection ${stabilityCountRef.current}/${STABILITY_THRESHOLD}: ${parsed.address}`);
                    } else {
                        // Nouveau résultat, reset compteur
                        stabilityCountRef.current = 1;
                        console.log(`[OCR] 📍 New detection: ${parsed.address}`);
                    }
                    lastResultRef.current = parsed;

                    // Si assez stable (2 détections similaires) → valider
                    if (stabilityCountRef.current >= STABILITY_THRESHOLD) {
                        console.log('[OCR] ✅ Address STABLE! Validating:', parsed.address);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        // Stopper les captures avant de retourner
                        if (captureIntervalRef.current) {
                            clearInterval(captureIntervalRef.current);
                            captureIntervalRef.current = null;
                        }

                        onDetected(parsed);
                        return;
                    } else {
                        setGuidanceMessage('Confirmation...');
                    }
                } else {
                    // Pas d'adresse valide → reset stabilité
                    lastResultRef.current = null;
                    stabilityCountRef.current = 0;
                    console.log('[OCR] ⚠️ No valid address, retrying...');
                    setAttemptCount(c => c + 1);
                    setGuidanceMessage('Adresse non détectée. Réessai...');
                }
            } else {
                // Pas de texte → reset stabilité
                lastResultRef.current = null;
                stabilityCountRef.current = 0;
                console.log('[OCR] ⚠️ No text detected, retrying...');
                setGuidanceMessage('Aucun texte. Rapprochez-vous.');
            }
        } catch (e) {
            console.error('[OCR] ❌ Capture error:', e);
            setGuidanceMessage('Erreur. Réessai...');
        }

        // Reset pour nouvelle tentative
        setTimeout(() => {
            isCapturingRef.current = false;
            setScannerState('scanning');
            setGuidanceMessage('Visez une étiquette...');
        }, RETRY_DELAY_MS);
    }, [onDetected, scannerState]);

    // --- AUTO-CAPTURE LOOP ---
    // Ref pour captureAndAnalyze afin d'éviter les dépendances dans useEffect
    const captureAndAnalyzeRef = useRef(captureAndAnalyze);
    captureAndAnalyzeRef.current = captureAndAnalyze;

    useEffect(() => {
        if (!isVisible) {
            // Cleanup quand invisible
            if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }
            isCapturingRef.current = false;
            return;
        }

        // Reset state quand visible
        setScannerState('scanning');
        setGuidanceMessage('Visez une étiquette...');
        setAttemptCount(0);
        isCapturingRef.current = false;
        lastResultRef.current = null;
        stabilityCountRef.current = 0;

        // Démarrer auto-capture après un délai initial (laisser l'autofocus se stabiliser)
        const startDelay = setTimeout(() => {
            console.log('[OCR] 🚀 Starting auto-capture loop');

            // Première capture
            captureAndAnalyzeRef.current();

            // Puis captures périodiques
            captureIntervalRef.current = setInterval(() => {
                if (!isCapturingRef.current) {
                    captureAndAnalyzeRef.current();
                }
            }, AUTO_CAPTURE_INTERVAL_MS);
        }, 1000); // 1s pour laisser iOS stabiliser la session caméra

        return () => {
            clearTimeout(startDelay);
            if (captureIntervalRef.current) {
                clearInterval(captureIntervalRef.current);
                captureIntervalRef.current = null;
            }
        };
    }, [isVisible]); // ⚠️ UNIQUEMENT isVisible - évite les re-renders qui cassent iOS

    // --- FOCUS (tap to focus) ---
    const handleFocus = useCallback((x: number, y: number) => {
        if (cameraRef.current) {
            console.log(`[Focus] Tapped at (${x.toFixed(0)}, ${y.toFixed(0)})`);
            cameraRef.current.focus({ x, y });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    }, []);

    const tapToFocusGesture = Gesture.Tap().onEnd((event) => {
        'worklet';
        runOnJS(handleFocus)(event.x, event.y);
    });

    // --- RENDER ---
    if (!hasPermission || !device) {
        return (
            <View style={styles.container}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.guidanceText}>Vérification des permissions...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <GestureDetector gesture={tapToFocusGesture}>
                <Camera
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={isVisible}
                    photo={true}
                    video={false}
                    audio={false}
                    format={format}
                    zoom={zoom}
                    enableZoomGesture
                />
            </GestureDetector>

            {/* Overlay et ROI */}
            <View style={styles.overlay} pointerEvents="none">
                <View style={[styles.darkArea, { height: ROI_TOP }]} />
                <View style={{ flexDirection: 'row' }}>
                    <View style={[styles.darkArea, { width: ROI_LEFT }]} />
                    <View style={[
                        styles.roi,
                        {
                            width: ROI_WIDTH,
                            height: ROI_HEIGHT,
                            borderColor: scannerState === 'analyzing' ? '#FFA500' : '#FFFFFF'
                        }
                    ]} />
                    <View style={[styles.darkArea, { width: ROI_LEFT }]} />
                </View>
                <View style={[styles.darkArea, { flex: 1 }]} />
            </View>

            {/* Close button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={28} color="#FFFFFF" weight="bold" />
            </TouchableOpacity>

            {/* Guidance */}
            <View style={styles.guidanceContainer}>
                <Text style={styles.guidanceText}>
                    {scannerState === 'analyzing' ? '🔍 Analyse...' : guidanceMessage}
                </Text>
                {attemptCount > 0 && (
                    <Text style={styles.attemptText}>Tentative {attemptCount}</Text>
                )}
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
                    onPress={() => setZoom(z => Math.min(device.maxZoom, z + 0.25))}
                >
                    <MagnifyingGlassPlus size={24} color="#FFFFFF" weight="bold" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

// --- STYLES ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center'
    },
    overlay: {
        ...StyleSheet.absoluteFillObject
    },
    darkArea: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    roi: {
        borderWidth: 2,
        borderRadius: 12
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
        alignItems: 'center'
    },
    guidanceContainer: {
        position: 'absolute',
        top: ROI_TOP + ROI_HEIGHT + 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    guidanceText: {
        color: 'white',
        textAlign: 'center',
        fontSize: 16
    },
    attemptText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        marginTop: 4,
    },
    zoomControls: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 30,
        padding: 4
    },
    zoomButton: {
        padding: 12
    },
    zoomIndicator: {
        paddingHorizontal: 16,
        justifyContent: 'center'
    },
    zoomText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    },
});

export default OCRScanner;
