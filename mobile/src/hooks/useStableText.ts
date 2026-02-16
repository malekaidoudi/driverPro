// =============================================================================
// SIGNATURE-BASED STABILIZATION (Spoke's Real Secret)
// Compare LOGICAL SIGNATURE (numbers + keywords), not raw text
// =============================================================================

import { useRef, useCallback } from 'react';

// Configuration
const CONFIG = {
  STABLE_FRAMES: 3,           // Same signature for N frames = stable
  MIN_TEXT_LENGTH: 8,         // Ignore too short text
  UNLOCK_FRAMES: 10,          // N frames sans texte avant unlock (augmenté pour robustesse)
};

// Mots-clés logistiques/adresse qui sont stables même avec OCR bruité
const STABLE_KEYWORDS = [
  // Logistique
  'reception', 'expedition', 'colis', 'livraison', 'kg', 'ship', 'TO', 'FROM',
  // Adresse
  'rue', 'avenue', 'boulevard', 'bd', 'av', 'place', 'allee', 'chemin',
  'impasse', 'passage', 'route', 'voie',
  // Ville/Code postal indicateurs
  'cedex', 'bp', 'cs',
  // Entreprise
  'sarl', 'sas', 'eurl', 'sa', 'sci',
];

/**
 * Normalise le texte pour extraction de signature
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Supprime accents
    .replace(/[^a-z0-9\s]/g, ' ')     // Que alphanumérique
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * EXTRACTION DE SIGNATURE LOGIQUE (le vrai secret de Spoke)
 * Extrait les patterns STABLES même quand l'OCR fait des erreurs:
 * - Numéros (codes postaux, téléphones, numéros de colis...)
 * - Mots-clés logistiques/adresse
 */
function extractSignature(text: string): string {
  if (!text) return '';

  const normalized = normalizeText(text);

  // 1. Extraire tous les nombres significatifs (2+ chiffres)
  const numbers = normalized.match(/\d{2,}/g) || [];
  // Trier pour consistance (même si ordre change dans l'OCR)
  const sortedNumbers = numbers.sort().join('-');

  // 2. Extraire les mots-clés logistiques présents
  const foundKeywords = STABLE_KEYWORDS
    .filter(kw => normalized.includes(kw))
    .sort()
    .join('-');

  // 3. Extraire les mots longs (5+ lettres) qui sont probablement des noms
  const longWords = normalized
    .split(' ')
    .filter(w => w.length >= 5 && /^[a-z]+$/.test(w))
    .slice(0, 3)  // Max 3 mots pour éviter bruit
    .sort()
    .join('-');

  // Signature = nombres | mots-clés | mots longs
  const signature = `${sortedNumbers}|${foundKeywords}|${longWords}`;

  return signature;
}

/**
 * Similarité ultra-légère pour 60 FPS
 * Compare caractère par caractère
 */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  const same = [...shorter].filter((c, i) => c === longer[i]).length;

  return same / longer.length;
}

export interface StableTextResult {
  currentText: string | null;    // Current frame's text
  stableText: string | null;     // Locked stable text (for parsing)
  signature: string;             // Current signature (for debug)
  isStable: boolean;             // Is text currently stable?
  stabilityCount: number;        // How many frames stable?
}

/**
 * Hook for text-based OCR stabilization
 * Returns stable text only after N consistent frames
 */
export function useStableText() {
  const lastTextRef = useRef<string | null>(null);
  const lastSignatureRef = useRef<string>('');
  const stableCountRef = useRef(0);
  const lockedTextRef = useRef<string | null>(null);
  const unstableCountRef = useRef(0);

  /**
   * Update with new OCR text
   * Returns stable result only when SIGNATURE is consistent
   */
  const update = useCallback((text: string | null): StableTextResult => {
    // No text or too short - NE PAS reset la signature!
    // Garder la mémoire pour quand le texte revient
    if (!text || text.length < CONFIG.MIN_TEXT_LENGTH) {
      unstableCountRef.current++;

      // Seulement reset après BEAUCOUP de frames sans texte
      if (unstableCountRef.current >= CONFIG.UNLOCK_FRAMES) {
        stableCountRef.current = 0;
        lockedTextRef.current = null;
        // NE PAS reset lastSignatureRef! Garder la mémoire.
      }

      return {
        currentText: text,
        stableText: lockedTextRef.current,
        signature: lastSignatureRef.current, // Garder la dernière signature
        isStable: lockedTextRef.current !== null,
        stabilityCount: stableCountRef.current,
      };
    }

    unstableCountRef.current = 0;

    // Extract SIGNATURE (numbers + keywords) - the key to stability!
    const currentSignature = extractSignature(text);

    // Compare SIGNATURES avec seuil de similarité > 0.8
    const isSimilar = lastSignatureRef.current
      ? similarity(currentSignature, lastSignatureRef.current) > 0.8
      : false;

    if (isSimilar) {
      // Same signature - increment stability
      stableCountRef.current++;

      if (__DEV__) {
        const sim = similarity(currentSignature, lastSignatureRef.current);
        console.log(`[STABLE] MATCH sim=${sim.toFixed(2)} count=${stableCountRef.current}/${CONFIG.STABLE_FRAMES}`);
      }

      if (stableCountRef.current >= CONFIG.STABLE_FRAMES) {
        // Lock this text
        lockedTextRef.current = text;

        if (__DEV__ && stableCountRef.current === CONFIG.STABLE_FRAMES) {
          console.log(`[STABLE] ✅ LOCKED! sig="${currentSignature}"`);
        }
      }
    } else {
      // Different signature - reset stability
      const prevCount = stableCountRef.current;
      stableCountRef.current = 1;

      if (__DEV__) {
        const sim = lastSignatureRef.current ? similarity(currentSignature, lastSignatureRef.current).toFixed(2) : 'N/A';
        console.log(`[STABLE] RESET sim=${sim} "${currentSignature.substring(0, 30)}" vs "${lastSignatureRef.current.substring(0, 30)}"`);
      }
    }

    lastTextRef.current = text;
    lastSignatureRef.current = currentSignature;

    return {
      currentText: text,
      stableText: lockedTextRef.current,
      signature: currentSignature,
      isStable: stableCountRef.current >= CONFIG.STABLE_FRAMES,
      stabilityCount: stableCountRef.current,
    };
  }, []);

  /**
   * Check if currently stable
   */
  const isStable = useCallback((): boolean => {
    return stableCountRef.current >= CONFIG.STABLE_FRAMES;
  }, []);

  /**
   * Get locked stable text
   */
  const getStableText = useCallback((): string | null => {
    return lockedTextRef.current;
  }, []);

  /**
   * Force reset
   */
  const reset = useCallback(() => {
    lastTextRef.current = null;
    lastSignatureRef.current = '';
    stableCountRef.current = 0;
    lockedTextRef.current = null;
    unstableCountRef.current = 0;
  }, []);

  return {
    update,
    isStable,
    getStableText,
    reset,
  };
}

export default useStableText;
