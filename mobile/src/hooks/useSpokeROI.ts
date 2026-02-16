// =============================================================================
// SPOKE-STYLE ROI TRACKER - 3 PHASES
// Phase 1: RECHERCHE (Large) - ROI grand, OCR cherche des blocs
// Phase 2: VERROUILLAGE (Zoom) - Rectangle se réduit sur le texte détecté
// Phase 3: LECTURE HP - OCR précis sur la zone verrouillée
// =============================================================================

import { useRef, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextBlock {
  text: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export type ROIPhase = 'search' | 'locking' | 'reading';

export interface SpokeROIResult {
  phase: ROIPhase;               // Phase actuelle du workflow
  roi: BoundingBox;              // Rectangle UX (grand en search, réduit en locking/reading)
  textBox: BoundingBox | null;   // Bounding box du texte détecté
  filteredBlocks: TextBlock[];   // Blocs dans le ROI
  filteredText: string;          // Texte brut extrait
  stableText: string | null;     // Texte STABLE (pour parsing)
  detected: boolean;             // Y a-t-il du texte dans le ROI?
  isTextStable: boolean;         // Le TEXTE est-il stable?
  stabilityCount: number;        // Nombre de frames stables
  isAddressLike: boolean;        // Le texte ressemble-t-il à une adresse?
}

// =============================================================================
// CONFIG - 3 PHASES ROI
// =============================================================================

const SEARCH_ROI_CONFIG = {
  widthPercent: 0.90,      // 90% - Large pour la recherche
  heightPercent: 0.40,     // 40% - Grande zone de scan
  xOffsetPercent: 0.05,    // Centré
  yOffsetPercent: 0.30,    // Un peu plus haut pour scanner large
};

const LOCKED_ROI_PADDING = 20; // Padding autour du texte détecté

const FILTER_CONFIG = {
  minOverlapRatio: 0.3,    // Bloc doit être à 30% dans le ROI
  tapSelectionRadius: 150, // Rayon de sélection au tap (pixels)
};

// =============================================================================
// DETECTION D'ADRESSE - Patterns français
// =============================================================================

const ADDRESS_PATTERNS = {
  postalCode: /\b\d{5}\b/,                    // 5 chiffres consécutifs
  streetTypes: /\b(rue|avenue|av|boulevard|bd|place|allée|allee|chemin|impasse|passage|route|voie|cours|square)\b/i,
  streetNumber: /^\d+\s*(?:bis|ter|quater)?/i,
};

function looksLikeAddress(text: string): boolean {
  if (!text || text.length < 10) return false;
  const hasPostalCode = ADDRESS_PATTERNS.postalCode.test(text);
  const hasStreetType = ADDRESS_PATTERNS.streetTypes.test(text);
  return hasPostalCode || hasStreetType;
}

// =============================================================================
// STABILISATION PAR SIGNATURE
// =============================================================================

const STABLE_CONFIG = {
  STABLE_FRAMES_LOCKING: 2,   // 2 frames pour passer en locking
  STABLE_FRAMES_READING: 3,   // 3 frames pour passer en reading
  MIN_TEXT_LENGTH: 8,
};

const STABLE_KEYWORDS = [
  'reception', 'expedition', 'colis', 'livraison', 'kg', 'ship',
  'rue', 'avenue', 'boulevard', 'bd', 'av', 'place', 'allee', 'chemin',
  'impasse', 'passage', 'route', 'voie', 'cedex', 'bp', 'cs',
  'sarl', 'sas', 'eurl', 'sa', 'sci',
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSignature(text: string): string {
  if (!text) return '';
  const normalized = normalizeText(text);
  const numbers = (normalized.match(/\d{2,}/g) || []).sort().join('-');
  const keywords = STABLE_KEYWORDS.filter(kw => normalized.includes(kw)).sort().join('-');
  const longWords = normalized.split(' ').filter(w => w.length >= 5 && /^[a-z]+$/.test(w)).slice(0, 3).sort().join('-');
  return `${numbers}|${keywords}|${longWords}`;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const same = [...shorter].filter((c, i) => c === longer[i]).length;
  return same / longer.length;
}

// =============================================================================
// MODULE 1 — ROI UX FIXE (ne dépend JAMAIS de l'OCR)
// =============================================================================

/**
 * ROI en coordonnées FRAME (pour filtrage OCR)
 */
export function getStaticROI(frameWidth: number, frameHeight: number): BoundingBox {
  return {
    width: Math.round(frameWidth * SEARCH_ROI_CONFIG.widthPercent),
    height: Math.round(frameHeight * SEARCH_ROI_CONFIG.heightPercent),
    x: Math.round(frameWidth * SEARCH_ROI_CONFIG.xOffsetPercent),
    y: Math.round(frameHeight * SEARCH_ROI_CONFIG.yOffsetPercent),
  };
}

/**
 * ROI en coordonnées SCREEN (pour affichage UX - FIXE)
 * Calculé directement, pas de conversion frame→screen
 */
export function getStaticROIScreen(screenWidth: number, screenHeight: number): BoundingBox {
  return {
    width: Math.round(screenWidth * SEARCH_ROI_CONFIG.widthPercent),
    height: Math.round(screenHeight * SEARCH_ROI_CONFIG.heightPercent),
    x: Math.round(screenWidth * SEARCH_ROI_CONFIG.xOffsetPercent),
    y: Math.round(screenHeight * SEARCH_ROI_CONFIG.yOffsetPercent),
  };
}

// =============================================================================
// MODULE 2 — FILTRAGE DES BLOCS DANS LE ROI
// =============================================================================

export function filterBlocksInROI(
  blocks: TextBlock[],
  roi: BoundingBox
): TextBlock[] {
  return blocks.filter(b => {
    if (!b.bounds) return false;

    const blockRight = b.bounds.x + b.bounds.width;
    const blockBottom = b.bounds.y + b.bounds.height;
    const roiRight = roi.x + roi.width;
    const roiBottom = roi.y + roi.height;

    // Calcul de l'intersection
    const xOverlap = Math.max(0, Math.min(blockRight, roiRight) - Math.max(b.bounds.x, roi.x));
    const yOverlap = Math.max(0, Math.min(blockBottom, roiBottom) - Math.max(b.bounds.y, roi.y));

    const overlapArea = xOverlap * yOverlap;
    const blockArea = b.bounds.width * b.bounds.height;

    // Garder si au moins 30% du bloc est dans le ROI
    return blockArea > 0 && (overlapArea / blockArea) >= FILTER_CONFIG.minOverlapRatio;
  });
}

// =============================================================================
// MODULE 3 — BOUNDING BOX PRÉCISE DU TEXTE DÉTECTÉ
// =============================================================================

export function computeTextBoundingBox(blocks: TextBlock[]): BoundingBox | null {
  if (blocks.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of blocks) {
    if (!b.bounds) continue;

    minX = Math.min(minX, b.bounds.x);
    minY = Math.min(minY, b.bounds.y);
    maxX = Math.max(maxX, b.bounds.x + b.bounds.width);
    maxY = Math.max(maxY, b.bounds.y + b.bounds.height);
  }

  if (minX === Infinity) return null;

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

// =============================================================================
// MODULE 4 — SÉLECTION PAR TAP (focus + priorisation locale)
// =============================================================================

export function pickBlocksNearTap(
  blocks: TextBlock[],
  tap: { x: number; y: number }
): TextBlock[] {
  return blocks.filter(b => {
    if (!b.bounds) return false;

    const cx = b.bounds.x + b.bounds.width / 2;
    const cy = b.bounds.y + b.bounds.height / 2;

    const dist = Math.hypot(cx - tap.x, cy - tap.y);

    return dist < FILTER_CONFIG.tapSelectionRadius;
  });
}

// =============================================================================
// HOOK PRINCIPAL — useSpokeROI
// =============================================================================

export function useSpokeROI() {
  // Cache du ROI fixe (calculé une seule fois par dimensions de frame)
  const roiCacheRef = useRef<{
    roi: BoundingBox;
    frameW: number;
    frameH: number;
  } | null>(null);

  // Point de tap utilisateur (optionnel)
  const tapPointRef = useRef<{ x: number; y: number } | null>(null);

  // === STABILISATION INTÉGRÉE (refs locales pour éviter problèmes de closure) ===
  const lastSignatureRef = useRef<string>('');
  const stableCountRef = useRef<number>(0);
  const lockedTextRef = useRef<string | null>(null);

  // Cache de la dernière box stable (affichée seulement quand texte stable)
  const lastStableBoxRef = useRef<BoundingBox | null>(null);
  const lastStableBlocksRef = useRef<TextBlock[]>([]);

  /**
   * Traite les blocs OCR et retourne le résultat filtré
   * @param blocks - Tous les blocs OCR détectés (de toute l'image)
   * @param frameW - Largeur de la frame caméra
   * @param frameH - Hauteur de la frame caméra
   */
  const processOCR = useCallback((
    blocks: TextBlock[],
    frameW: number,
    frameH: number
  ): SpokeROIResult => {
    // Étape 1: Obtenir le ROI fixe (ou le recalculer si dimensions changent)
    let roi: BoundingBox;

    if (
      roiCacheRef.current &&
      roiCacheRef.current.frameW === frameW &&
      roiCacheRef.current.frameH === frameH
    ) {
      roi = roiCacheRef.current.roi;
    } else {
      roi = getStaticROI(frameW, frameH);
      roiCacheRef.current = { roi, frameW, frameH };

      if (__DEV__) {
        console.log(`[SPOKE ROI] Static ROI: x=${roi.x}, y=${roi.y}, w=${roi.width}, h=${roi.height}`);
      }
    }

    // Étape 2: Filtrer les blocs dans le ROI
    let filteredBlocks = filterBlocksInROI(blocks, roi);

    // Étape 2b: Si tap actif, prioriser les blocs proches du tap
    if (tapPointRef.current && filteredBlocks.length > 0) {
      const nearTap = pickBlocksNearTap(filteredBlocks, tapPointRef.current);
      if (nearTap.length > 0) {
        filteredBlocks = nearTap;
        if (__DEV__) {
          console.log(`[SPOKE ROI] Tap selection: ${nearTap.length} blocks near tap`);
        }
      }
    }

    // Étape 3: Extraire le texte brut
    const filteredText = filteredBlocks.map(b => b.text).join('\n');

    // Étape 4: STABILISATION PAR SIGNATURE (intégrée directement!)
    let isTextStable = false;
    let stabilityCount = stableCountRef.current;

    if (filteredText && filteredText.length >= STABLE_CONFIG.MIN_TEXT_LENGTH) {
      const currentSig = extractSignature(filteredText);
      const lastSig = lastSignatureRef.current;

      // Comparer signatures avec seuil de similarité
      const sim = lastSig ? similarity(currentSig, lastSig) : 0;
      const isSimilar = sim > 0.8;

      if (isSimilar) {
        stableCountRef.current++;
        stabilityCount = stableCountRef.current;

        if (__DEV__) {
          console.log(`[STABLE] MATCH sim=${sim.toFixed(2)} count=${stabilityCount}/${STABLE_CONFIG.STABLE_FRAMES_READING}`);
        }

        if (stabilityCount >= STABLE_CONFIG.STABLE_FRAMES_READING) {
          lockedTextRef.current = filteredText;
          isTextStable = true;

          if (__DEV__ && stabilityCount === STABLE_CONFIG.STABLE_FRAMES_READING) {
            console.log(`[STABLE] ✅ LOCKED! sig="${currentSig.substring(0, 40)}"`);
          }
        }
      } else {
        stableCountRef.current = 1;
        stabilityCount = 1;

        if (__DEV__) {
          console.log(`[STABLE] RESET sim=${sim.toFixed(2)} "${currentSig.substring(0, 30)}" vs "${lastSig.substring(0, 30)}"`);
        }
      }

      // CRUCIAL: Mettre à jour la signature pour la prochaine frame
      lastSignatureRef.current = currentSig;
    }

    // Étape 5: Calculer la box SEULEMENT si le texte est stable
    let textBox: BoundingBox | null = null;

    if (isTextStable && filteredBlocks.length > 0) {
      // Texte stable → on peut afficher la box
      textBox = computeTextBoundingBox(filteredBlocks);
      lastStableBoxRef.current = textBox;
      lastStableBlocksRef.current = filteredBlocks;
    } else if (stabilityCount >= 2 && lastStableBoxRef.current) {
      // Presque stable → garder dernière box pour éviter clignotement
      textBox = lastStableBoxRef.current;
    }
    // Sinon textBox reste null → pas de rectangle affiché

    // Déterminer la phase actuelle
    const isAddressLike = looksLikeAddress(filteredText);
    let phase: ROIPhase = 'search';
    if (stabilityCount >= STABLE_CONFIG.STABLE_FRAMES_READING && isAddressLike) {
      phase = 'reading';
    } else if (stabilityCount >= STABLE_CONFIG.STABLE_FRAMES_LOCKING && isAddressLike) {
      phase = 'locking';
    }

    if (__DEV__ && filteredBlocks.length > 0) {
      console.log(`[SPOKE] ${filteredBlocks.length} blocks, phase=${phase}, stable=${isTextStable} (${stabilityCount}/${STABLE_CONFIG.STABLE_FRAMES_READING})`);
    }

    return {
      phase,                            // Phase: search → locking → reading
      roi,                              // Rectangle UX
      textBox,                          // Box affichée SEULEMENT si texte stable
      filteredBlocks,                   // Blocs filtrés
      filteredText,                     // Texte brut
      stableText: lockedTextRef.current, // Texte STABLE pour parsing
      detected: filteredBlocks.length > 0,
      isTextStable,                     // Texte stable?
      stabilityCount,
      isAddressLike,                    // Ressemble à une adresse?
    };
  }, []);

  /**
   * Définir un point de tap pour la sélection locale
   */
  const setTapPoint = useCallback((x: number, y: number) => {
    tapPointRef.current = { x, y };
    if (__DEV__) {
      console.log(`[SPOKE ROI] Tap set at (${Math.round(x)}, ${Math.round(y)})`);
    }
  }, []);

  /**
   * Effacer le point de tap
   */
  const clearTapPoint = useCallback(() => {
    tapPointRef.current = null;
    if (__DEV__) {
      console.log('[SPOKE ROI] Tap cleared');
    }
  }, []);

  /**
   * Reset complet
   */
  const reset = useCallback(() => {
    roiCacheRef.current = null;
    tapPointRef.current = null;
    lastSignatureRef.current = '';
    stableCountRef.current = 0;
    lockedTextRef.current = null;
    lastStableBoxRef.current = null;
    lastStableBlocksRef.current = [];
  }, []);

  return {
    processOCR,
    setTapPoint,
    clearTapPoint,
    reset,
  };
}

// =============================================================================
// HELPER: Convert OCR Result to TextBlocks
// =============================================================================

export function ocrResultToTextBlocks(ocrResult: any): TextBlock[] {
  if (!ocrResult) return [];

  const textBlocks: TextBlock[] = [];
  const blocks = ocrResult.blocks;

  if (blocks && Array.isArray(blocks)) {
    for (const block of blocks) {
      const blockFrame = block.blockFrame;
      const blockText = block.blockText;

      if (blockFrame && typeof blockFrame.x === 'number') {
        textBlocks.push({
          text: blockText || '',
          bounds: {
            x: blockFrame.x,
            y: blockFrame.y,
            width: blockFrame.width,
            height: blockFrame.height,
          },
        });
      }

      // Also add individual lines for more precision
      const lines = block.lines;
      if (lines && Array.isArray(lines)) {
        for (const line of lines) {
          const lineFrame = line.lineFrame;
          const lineText = line.lineText;

          if (lineFrame && typeof lineFrame.x === 'number') {
            textBlocks.push({
              text: lineText || '',
              bounds: {
                x: lineFrame.x,
                y: lineFrame.y,
                width: lineFrame.width,
                height: lineFrame.height,
              },
            });
          }
        }
      }
    }
  }

  return textBlocks;
}

// =============================================================================
// HELPER: Scale ROI from frame coords to screen coords
// =============================================================================

export function scaleROIToScreen(
  roi: BoundingBox,
  frameWidth: number,
  frameHeight: number,
  screenWidth: number,
  screenHeight: number
): BoundingBox {
  // Detect if frame needs rotation based on aspect ratios
  const frameIsLandscape = frameWidth > frameHeight;
  const screenIsPortrait = screenHeight > screenWidth;
  const needsRotation = frameIsLandscape && screenIsPortrait;

  if (needsRotation) {
    // Frame is landscape (e.g., 1920x1080), screen is portrait (e.g., 390x844)
    // OCR coordinates are in frame space, need to rotate 90° CW
    const scaleX = screenWidth / frameHeight;
    const scaleY = screenHeight / frameWidth;

    return {
      x: Math.round((frameHeight - roi.y - roi.height) * scaleX),
      y: Math.round(roi.x * scaleY),
      width: Math.round(roi.height * scaleX),
      height: Math.round(roi.width * scaleY),
    };
  } else {
    // No rotation needed - direct scaling
    const scaleX = screenWidth / frameWidth;
    const scaleY = screenHeight / frameHeight;

    return {
      x: Math.round(roi.x * scaleX),
      y: Math.round(roi.y * scaleY),
      width: Math.round(roi.width * scaleX),
      height: Math.round(roi.height * scaleY),
    };
  }
}

export default useSpokeROI;
