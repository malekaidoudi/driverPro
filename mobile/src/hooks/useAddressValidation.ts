/**
 * useAddressValidation Hook
 * 
 * Hybrid OCR Workflow - Phase 2: Backend Validation
 * 
 * Features:
 * - Debounced API calls (500ms) to avoid spamming backend
 * - Local cache to avoid duplicate requests for same text
 * - Automatic fallback to local parsing if network fails
 * - Status tracking: idle → validating → validated/error
 */

import { useState, useRef, useCallback } from 'react';
import { servicesApi } from '../services/api';
import { ocrLogger } from '../services/ocrLogger';
import {
    OCRValidationResponse,
    OCRValidatedAddress,
    OCRValidatedContact
} from '../types';
import { ParsedAddress } from './useOCRParsing';

// =============================================================================
// TYPES
// =============================================================================

export type ValidationStatus = 'idle' | 'scanning' | 'validating' | 'validated' | 'error';

export interface ValidationState {
    status: ValidationStatus;
    rawText: string | null;
    localParsed: ParsedAddress | null;      // Phase 1: ML Kit local parsing
    validatedData: OCRValidationResponse | null;  // Phase 2: Backend validation
    error: string | null;
    isNetworkError: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEBOUNCE_MS = 500;  // Wait 500ms before sending to backend
const CACHE_SIZE = 20;    // Keep last 20 validations in cache
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache expires after 5 minutes

// =============================================================================
// CACHE
// =============================================================================

interface CacheEntry {
    key: string;
    response: OCRValidationResponse;
    timestamp: number;
}

const validationCache: CacheEntry[] = [];

function getCacheKey(text: string): string {
    // Normalize text for cache key
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 200); // Limit key size
}

function getFromCache(text: string): OCRValidationResponse | null {
    const key = getCacheKey(text);
    const now = Date.now();

    const entry = validationCache.find(e => e.key === key);
    if (entry && (now - entry.timestamp) < CACHE_TTL_MS) {
        console.log('[AddressValidation] Cache HIT');
        return entry.response;
    }

    return null;
}

function addToCache(text: string, response: OCRValidationResponse): void {
    const key = getCacheKey(text);

    // Remove existing entry with same key
    const existingIndex = validationCache.findIndex(e => e.key === key);
    if (existingIndex >= 0) {
        validationCache.splice(existingIndex, 1);
    }

    // Add new entry
    validationCache.push({
        key,
        response,
        timestamp: Date.now()
    });

    // Evict old entries if cache is full
    while (validationCache.length > CACHE_SIZE) {
        validationCache.shift();
    }
}

// =============================================================================
// HOOK
// =============================================================================

export function useAddressValidation() {
    const [state, setState] = useState<ValidationState>({
        status: 'idle',
        rawText: null,
        localParsed: null,
        validatedData: null,
        error: null,
        isNetworkError: false,
    });

    // Debounce timer ref
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    // Track current validation to cancel if new one comes in
    const currentValidationRef = useRef<string | null>(null);

    /**
     * Phase 1: Update with local ML Kit parsing (instant)
     * Shows "SCANNING" status with raw detected text
     */
    const updateLocalParsing = useCallback((rawText: string, localParsed: ParsedAddress) => {
        setState(prev => ({
            ...prev,
            status: 'scanning',
            rawText,
            localParsed,
            error: null,
            isNetworkError: false,
        }));
    }, []);

    /**
     * Phase 2: Trigger backend validation (debounced)
     * Call this when ML Kit text is stable (3 consecutive frames)
     */
    const validateWithBackend = useCallback(async (
        rawText: string,
        localParsed: ParsedAddress
    ): Promise<OCRValidationResponse | null> => {
        // Cancel any pending debounce
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Check cache first
        const cacheKey = rawText.substring(0, 30);
        const cached = getFromCache(rawText);
        if (cached) {
            ocrLogger.logCacheHit(cacheKey);
            setState(prev => ({
                ...prev,
                status: 'validated',
                rawText,
                localParsed,
                validatedData: cached,
                error: null,
                isNetworkError: false,
            }));
            ocrLogger.logValidationComplete('CACHE_HIT');
            return cached;
        }
        ocrLogger.logCacheMiss(cacheKey);

        // Set validating status
        setState(prev => ({
            ...prev,
            status: 'validating',
            rawText,
            localParsed,
        }));

        // Track this validation
        currentValidationRef.current = rawText;

        return new Promise((resolve) => {
            debounceTimerRef.current = setTimeout(async () => {
                // Check if this validation is still current
                if (currentValidationRef.current !== rawText) {
                    resolve(null);
                    return;
                }

                try {
                    ocrLogger.logRequestStart(rawText);

                    const response = await servicesApi.validateOCRAddress({
                        raw_text: rawText,
                        first_name: localParsed.firstName,
                        last_name: localParsed.lastName,
                        phone: localParsed.phoneNumber,
                        company: localParsed.companyName,
                    });

                    // Check if still current
                    if (currentValidationRef.current !== rawText) {
                        resolve(null);
                        return;
                    }

                    // Cache the result
                    addToCache(rawText, response);

                    ocrLogger.logRequestSuccess({
                        is_valid: response.validation.is_valid,
                        confidence: response.validation.confidence,
                        validation_method: response.validation.source,
                    });

                    setState(prev => ({
                        ...prev,
                        status: 'validated',
                        validatedData: response,
                        error: null,
                        isNetworkError: false,
                    }));

                    resolve(response);

                } catch (error: any) {
                    const isNetErr =
                        error.code === 'ECONNABORTED' ||
                        error.code === 'ERR_NETWORK' ||
                        !error.response;
                    ocrLogger.logRequestError(error, isNetErr);

                    // Check if still current
                    if (currentValidationRef.current !== rawText) {
                        resolve(null);
                        return;
                    }

                    // Network error - allow manual fallback
                    const isNetworkError =
                        error.code === 'ECONNABORTED' ||
                        error.code === 'ERR_NETWORK' ||
                        !error.response;

                    setState(prev => ({
                        ...prev,
                        status: 'error',
                        error: isNetworkError
                            ? 'Connexion réseau impossible'
                            : 'Erreur de validation',
                        isNetworkError,
                    }));

                    resolve(null);
                }
            }, DEBOUNCE_MS);
        });
    }, []);

    /**
     * Get the best available address data
     * Prefers backend validation, falls back to local parsing
     */
    const getBestAddress = useCallback((): {
        street: string;
        postalCode: string;
        city: string;
        latitude?: number;
        longitude?: number;
        isValidated: boolean;
        confidence: number;
    } | null => {
        // Prefer backend validated data
        if (state.validatedData?.validation.is_valid) {
            const addr = state.validatedData.address;
            return {
                street: addr.street || '',
                postalCode: addr.postal_code || '',
                city: addr.city || '',
                latitude: addr.latitude,
                longitude: addr.longitude,
                isValidated: true,
                confidence: state.validatedData.validation.confidence,
            };
        }

        // Fallback to local parsing
        if (state.localParsed) {
            return {
                street: state.localParsed.street || '',
                postalCode: state.localParsed.postalCode || '',
                city: state.localParsed.city || '',
                latitude: undefined,
                longitude: undefined,
                isValidated: false,
                confidence: state.localParsed.confidence,
            };
        }

        return null;
    }, [state.validatedData, state.localParsed]);

    /**
     * Get the best available contact data
     */
    const getBestContact = useCallback((): {
        firstName: string;
        lastName: string;
        phone: string;
        company: string;
    } | null => {
        // Prefer backend validated data
        if (state.validatedData?.contact) {
            const contact = state.validatedData.contact;
            return {
                firstName: contact.first_name || state.localParsed?.firstName || '',
                lastName: contact.last_name || state.localParsed?.lastName || '',
                phone: contact.phone || state.localParsed?.phoneNumber || '',
                company: contact.company || state.localParsed?.companyName || '',
            };
        }

        // Fallback to local parsing
        if (state.localParsed) {
            return {
                firstName: state.localParsed.firstName || '',
                lastName: state.localParsed.lastName || '',
                phone: state.localParsed.phoneNumber || '',
                company: state.localParsed.companyName || '',
            };
        }

        return null;
    }, [state.validatedData, state.localParsed]);

    /**
     * Reset state
     */
    const reset = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        currentValidationRef.current = null;

        setState({
            status: 'idle',
            rawText: null,
            localParsed: null,
            validatedData: null,
            error: null,
            isNetworkError: false,
        });
    }, []);

    /**
     * Accept local parsing as final (manual fallback)
     */
    const acceptLocalParsing = useCallback(() => {
        setState(prev => ({
            ...prev,
            status: 'validated',
            error: null,
        }));
    }, []);

    return {
        // State
        status: state.status,
        rawText: state.rawText,
        localParsed: state.localParsed,
        validatedData: state.validatedData,
        error: state.error,
        isNetworkError: state.isNetworkError,

        // Actions
        updateLocalParsing,
        validateWithBackend,
        getBestAddress,
        getBestContact,
        acceptLocalParsing,
        reset,
    };
}

export default useAddressValidation;
