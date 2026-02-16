// =============================================================================
// DYNAMIC ROI TRACKER FOR REACT NATIVE
// Kalman-filtered bounding box tracking for smooth OCR region display
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

export interface ROIState {
  roi: BoundingBox | null;
  isStable: boolean;
  confidence: number;
}

interface TrackerConfig {
  processNoise: number;
  measurementNoise: number;
  stabilityThresholdMs: number;
  stabilityMovementThreshold: number;
  paddingPercent: number;
  minWidth: number;
  minHeight: number;
}

const DEFAULT_CONFIG: TrackerConfig = {
  processNoise: 0.08,
  measurementNoise: 3,
  stabilityThresholdMs: 400,
  stabilityMovementThreshold: 15,
  paddingPercent: 0.12,
  minWidth: 100,
  minHeight: 50,
};

// =============================================================================
// INTELLIGENT ROI DETECTION CONFIG
// =============================================================================

const ROI_FILTER_CONFIG = {
  // Étape 1: Filtrage des blocs parasites
  minBlockArea: 400,           // Ignorer blocs < 20x20 px
  minBlockWidth: 15,           // Largeur min
  minBlockHeight: 8,           // Hauteur min
  maxAspectRatio: 25,          // Ignorer blocs trop étirés (ex: lignes fines)
  minAspectRatio: 0.05,        // Ignorer blocs trop verticaux

  // Étape 2: Clustering spatial
  verticalClusterThreshold: 80, // Distance Y max pour grouper des blocs
  minClusterBlocks: 2,          // Min blocs pour former un cluster valide

  // Étape 3: Fallback
  fallbackWidthPercent: 0.85,   // Largeur du rectangle central
  fallbackHeightPercent: 0.25,  // Hauteur du rectangle central
  fallbackYOffsetPercent: 0.35, // Position Y (35% depuis le haut)

  // ROI taille fixe (en pixels frame)
  fixedROIWidth: 350,           // Largeur fixe du ROI
  fixedROIHeight: 600,          // Hauteur fixe du ROI
};

// =============================================================================
// KALMAN FILTER 1D
// =============================================================================

class KalmanFilter1D {
  private q: number;
  private r: number;
  private x: number;
  private p: number;

  constructor(q: number, r: number, initial: number = 0) {
    this.q = q;
    this.r = r;
    this.x = initial;
    this.p = 1;
  }

  update(measurement: number): number {
    // Prediction
    this.p = this.p + this.q;

    // Update
    const k = this.p / (this.p + this.r);
    this.x = this.x + k * (measurement - this.x);
    this.p = (1 - k) * this.p;

    return this.x;
  }

  reset(value: number): void {
    this.x = value;
    this.p = 1;
  }

  getValue(): number {
    return this.x;
  }
}

// =============================================================================
// BOX TRACKER
// =============================================================================

class BoxTracker {
  private xFilter: KalmanFilter1D;
  private yFilter: KalmanFilter1D;
  private wFilter: KalmanFilter1D;
  private hFilter: KalmanFilter1D;
  private initialized: boolean = false;
  private config: TrackerConfig;

  constructor(config: TrackerConfig) {
    this.config = config;
    this.xFilter = new KalmanFilter1D(config.processNoise, config.measurementNoise);
    this.yFilter = new KalmanFilter1D(config.processNoise, config.measurementNoise);
    this.wFilter = new KalmanFilter1D(config.processNoise, config.measurementNoise);
    this.hFilter = new KalmanFilter1D(config.processNoise, config.measurementNoise);
  }

  update(box: BoundingBox): BoundingBox {
    if (!this.initialized) {
      this.xFilter.reset(box.x);
      this.yFilter.reset(box.y);
      this.wFilter.reset(box.width);
      this.hFilter.reset(box.height);
      this.initialized = true;
      return box;
    }

    return {
      x: Math.round(this.xFilter.update(box.x)),
      y: Math.round(this.yFilter.update(box.y)),
      width: Math.round(this.wFilter.update(box.width)),
      height: Math.round(this.hFilter.update(box.height)),
    };
  }

  reset(): void {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

// =============================================================================
// ÉTAPE 1: Filtrer les blocs parasites
// =============================================================================

function filterParasiteBlocks(blocks: TextBlock[]): TextBlock[] {
  return blocks.filter((block) => {
    if (!block.bounds) return false;

    const { width, height } = block.bounds;
    const area = width * height;
    const aspectRatio = width / Math.max(height, 1);

    // Filtrer par taille minimum
    if (area < ROI_FILTER_CONFIG.minBlockArea) return false;
    if (width < ROI_FILTER_CONFIG.minBlockWidth) return false;
    if (height < ROI_FILTER_CONFIG.minBlockHeight) return false;

    // Filtrer par ratio largeur/hauteur (éviter lignes fines ou blocs trop verticaux)
    if (aspectRatio > ROI_FILTER_CONFIG.maxAspectRatio) return false;
    if (aspectRatio < ROI_FILTER_CONFIG.minAspectRatio) return false;

    // Filtrer blocs avec très peu de texte (probablement du bruit)
    if (block.text && block.text.length < 2) return false;

    return true;
  });
}

// =============================================================================
// ÉTAPE 2: Clustering spatial par position Y
// =============================================================================

interface BlockCluster {
  blocks: TextBlock[];
  minY: number;
  maxY: number;
  totalArea: number;
  totalChars: number;
}

function clusterBlocksByY(blocks: TextBlock[]): BlockCluster[] {
  if (blocks.length === 0) return [];

  // Trier par Y (position verticale)
  const sorted = [...blocks].sort((a, b) => {
    const aY = a.bounds?.y || 0;
    const bY = b.bounds?.y || 0;
    return aY - bY;
  });

  const clusters: BlockCluster[] = [];
  let currentCluster: BlockCluster = {
    blocks: [sorted[0]],
    minY: sorted[0].bounds!.y,
    maxY: sorted[0].bounds!.y + sorted[0].bounds!.height,
    totalArea: sorted[0].bounds!.width * sorted[0].bounds!.height,
    totalChars: sorted[0].text?.length || 0,
  };

  for (let i = 1; i < sorted.length; i++) {
    const block = sorted[i];
    const blockY = block.bounds!.y;
    const blockBottom = blockY + block.bounds!.height;
    const blockArea = block.bounds!.width * block.bounds!.height;
    const blockChars = block.text?.length || 0;

    // Distance verticale entre le bas du cluster et le haut du bloc
    const verticalGap = blockY - currentCluster.maxY;

    if (verticalGap <= ROI_FILTER_CONFIG.verticalClusterThreshold) {
      // Ajouter au cluster actuel
      currentCluster.blocks.push(block);
      currentCluster.maxY = Math.max(currentCluster.maxY, blockBottom);
      currentCluster.totalArea += blockArea;
      currentCluster.totalChars += blockChars;
    } else {
      // Nouveau cluster
      clusters.push(currentCluster);
      currentCluster = {
        blocks: [block],
        minY: blockY,
        maxY: blockBottom,
        totalArea: blockArea,
        totalChars: blockChars,
      };
    }
  }

  // Ajouter le dernier cluster
  clusters.push(currentCluster);

  return clusters;
}

function selectBestCluster(clusters: BlockCluster[], tapPoint?: { x: number; y: number } | null): BlockCluster | null {
  if (clusters.length === 0) return null;

  // Si tap point fourni, sélectionner le cluster le plus proche
  if (tapPoint) {
    let closestCluster: BlockCluster | null = null;
    let minDistance = Infinity;

    for (const cluster of clusters) {
      // Calculer le centre du cluster
      const clusterCenterY = (cluster.minY + cluster.maxY) / 2;

      // Calculer le centre X du cluster
      let minX = Infinity, maxX = -Infinity;
      for (const block of cluster.blocks) {
        if (block.bounds) {
          minX = Math.min(minX, block.bounds.x);
          maxX = Math.max(maxX, block.bounds.x + block.bounds.width);
        }
      }
      const clusterCenterX = (minX + maxX) / 2;

      // Distance euclidienne
      const distance = Math.sqrt(
        Math.pow(tapPoint.x - clusterCenterX, 2) +
        Math.pow(tapPoint.y - clusterCenterY, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestCluster = cluster;
      }
    }

    if (__DEV__ && closestCluster) {
      console.log(`[ROI] Tap selected cluster: ${closestCluster.blocks.length} blocks, distance=${Math.round(minDistance)}`);
    }

    return closestCluster;
  }

  // Sinon, sélection automatique
  // Filtrer clusters avec assez de blocs
  const validClusters = clusters.filter(
    (c) => c.blocks.length >= ROI_FILTER_CONFIG.minClusterBlocks
  );

  if (validClusters.length === 0) {
    // Fallback: prendre le plus gros cluster même s'il n'a qu'un bloc
    return clusters.reduce((best, c) =>
      c.totalArea > best.totalArea ? c : best
    );
  }

  // Scorer chaque cluster: pondérer surface + caractères
  return validClusters.reduce((best, cluster) => {
    const bestScore = best.totalArea * 0.5 + best.totalChars * 10;
    const clusterScore = cluster.totalArea * 0.5 + cluster.totalChars * 10;
    return clusterScore > bestScore ? cluster : best;
  });
}

// =============================================================================
// ÉTAPE 3: Fallback rectangle central
// =============================================================================

function getFallbackROI(frameWidth: number, frameHeight: number): BoundingBox {
  const width = Math.round(frameWidth * ROI_FILTER_CONFIG.fallbackWidthPercent);
  const height = Math.round(frameHeight * ROI_FILTER_CONFIG.fallbackHeightPercent);
  const x = Math.round((frameWidth - width) / 2);
  const y = Math.round(frameHeight * ROI_FILTER_CONFIG.fallbackYOffsetPercent);

  return { x, y, width, height };
}

// =============================================================================
// MAIN: Compute intelligent ROI from blocks
// =============================================================================

// Retourne: { clusters, selectedCluster, fixedROI }
interface ClusterResult {
  clusters: BlockCluster[];
  selectedCluster: BlockCluster | null;
  fixedROI: BoundingBox;
}

function computeClusterAndROI(
  blocks: TextBlock[],
  frameWidth: number,
  frameHeight: number,
  tapPoint?: { x: number; y: number } | null
): ClusterResult {
  const fallbackROI = getFallbackROI(frameWidth, frameHeight);

  // Étape 1: Filtrer les blocs parasites
  const filteredBlocks = filterParasiteBlocks(blocks);

  if (__DEV__ && blocks.length > 0) {
    console.log(`[ROI] Filtered: ${filteredBlocks.length}/${blocks.length} blocks kept`);
  }

  if (filteredBlocks.length === 0) {
    if (__DEV__) console.log('[ROI] No valid blocks → using fallback ROI');
    return { clusters: [], selectedCluster: null, fixedROI: fallbackROI };
  }

  // Étape 2: Clustering spatial
  const clusters = clusterBlocksByY(filteredBlocks);

  if (__DEV__) {
    console.log(`[ROI] Found ${clusters.length} clusters`);
  }

  // Étape 3: Sélectionner le meilleur cluster (ou celui proche du tap)
  const selectedCluster = selectBestCluster(clusters, tapPoint);

  if (!selectedCluster) {
    if (__DEV__) console.log('[ROI] No valid cluster → using fallback ROI');
    return { clusters, selectedCluster: null, fixedROI: fallbackROI };
  }

  if (__DEV__) {
    console.log(`[ROI] Selected cluster: ${selectedCluster.blocks.length} blocks, ${selectedCluster.totalChars} chars`);
  }

  // Calculer le CENTRE du cluster sélectionné
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const block of selectedCluster.blocks) {
    const b = block.bounds!;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  const clusterCenterX = (minX + maxX) / 2;
  const clusterCenterY = (minY + maxY) / 2;

  // ROI de taille FIXE centré sur le cluster
  const roiWidth = ROI_FILTER_CONFIG.fixedROIWidth;
  const roiHeight = ROI_FILTER_CONFIG.fixedROIHeight;

  let roiX = clusterCenterX - roiWidth / 2;
  let roiY = clusterCenterY - roiHeight / 2;

  // Clamp aux limites de la frame
  roiX = Math.max(0, Math.min(frameWidth - roiWidth, roiX));
  roiY = Math.max(0, Math.min(frameHeight - roiHeight, roiY));

  const fixedROI: BoundingBox = {
    x: Math.round(roiX),
    y: Math.round(roiY),
    width: roiWidth,
    height: roiHeight,
  };

  if (__DEV__) {
    console.log(`[ROI] Fixed ROI centered at (${Math.round(clusterCenterX)}, ${Math.round(clusterCenterY)})`);
  }

  return { clusters, selectedCluster, fixedROI };
}

// Legacy function for compatibility
function computeBoundingBoxFromBlocks(
  blocks: TextBlock[],
  frameWidth: number,
  frameHeight: number
): BoundingBox | null {
  const result = computeClusterAndROI(blocks, frameWidth, frameHeight);
  return result.fixedROI;
}

function addPadding(
  box: BoundingBox,
  paddingPercent: number,
  maxWidth: number,
  maxHeight: number
): BoundingBox {
  const padX = Math.round(box.width * paddingPercent);
  const padY = Math.round(box.height * paddingPercent);

  const x = Math.max(0, box.x - padX);
  const y = Math.max(0, box.y - padY);
  const width = Math.min(maxWidth - x, box.width + padX * 2);
  const height = Math.min(maxHeight - y, box.height + padY * 2);

  return { x, y, width, height };
}

function boxDistance(a: BoundingBox, b: BoundingBox): number {
  return (
    Math.abs(a.x - b.x) +
    Math.abs(a.y - b.y) +
    Math.abs(a.width - b.width) +
    Math.abs(a.height - b.height)
  );
}

function scoreTextBlocks(blocks: TextBlock[]): number {
  if (blocks.length === 0) return 0;

  let totalScore = 0;
  let lineCount = 0;

  for (const block of blocks) {
    if (block.bounds && block.text) {
      // Score based on text length and block size
      const textScore = Math.min(block.text.length / 50, 1);
      const sizeScore = Math.min((block.bounds.width * block.bounds.height) / 10000, 1);
      totalScore += (textScore + sizeScore) / 2;
      lineCount++;
    }
  }

  // Bonus for multiple lines (typical address has 3-5 lines)
  const lineBonus = lineCount >= 3 && lineCount <= 6 ? 0.2 : 0;

  return Math.min(totalScore / Math.max(lineCount, 1) + lineBonus, 1);
}

// =============================================================================
// HOOK: useROITracker
// =============================================================================

export function useROITracker(config: Partial<TrackerConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const trackerRef = useRef<BoxTracker>(new BoxTracker(mergedConfig));
  const lastROIRef = useRef<BoundingBox | null>(null);
  const lastChangeTimeRef = useRef<number>(Date.now());
  const isStableRef = useRef<boolean>(false);

  // Tap selection: store user tap point (in frame coordinates)
  const userTapPointRef = useRef<{ x: number; y: number } | null>(null);
  // Store all clusters for tap selection
  const lastClustersRef = useRef<BlockCluster[]>([]);

  const updateROI = useCallback(
    (
      textBlocks: TextBlock[],
      frameWidth: number,
      frameHeight: number
    ): ROIState => {
      // Compute cluster and fixed ROI using intelligent detection
      const result = computeClusterAndROI(
        textBlocks,
        frameWidth,
        frameHeight,
        userTapPointRef.current
      );

      // Store clusters for potential tap selection
      lastClustersRef.current = result.clusters;

      const rawBox = result.fixedROI;

      if (!rawBox) {
        return {
          roi: lastROIRef.current,
          isStable: false,
          confidence: 0,
        };
      }

      // Smooth with Kalman filter
      const smoothedBox = trackerRef.current.update(rawBox);

      // Check stability
      const now = Date.now();
      if (lastROIRef.current) {
        const distance = boxDistance(smoothedBox, lastROIRef.current);
        if (distance > mergedConfig.stabilityMovementThreshold) {
          lastChangeTimeRef.current = now;
          isStableRef.current = false;
        } else {
          const stableDuration = now - lastChangeTimeRef.current;
          isStableRef.current = stableDuration >= mergedConfig.stabilityThresholdMs;
        }
      } else {
        lastChangeTimeRef.current = now;
        isStableRef.current = false;
      }

      lastROIRef.current = smoothedBox;

      // Compute confidence based on selected cluster
      const confidence = result.selectedCluster
        ? scoreTextBlocks(result.selectedCluster.blocks)
        : 0;

      return {
        roi: smoothedBox,
        isStable: isStableRef.current,
        confidence,
      };
    },
    [mergedConfig]
  );

  const reset = useCallback(() => {
    trackerRef.current.reset();
    lastROIRef.current = null;
    lastChangeTimeRef.current = Date.now();
    isStableRef.current = false;
    userTapPointRef.current = null;
    lastClustersRef.current = [];
  }, []);

  const getCurrentROI = useCallback((): BoundingBox | null => {
    return lastROIRef.current;
  }, []);

  const isStable = useCallback((): boolean => {
    return isStableRef.current;
  }, []);

  // Set tap point for cluster selection (in FRAME coordinates)
  const setTapPoint = useCallback((x: number, y: number) => {
    userTapPointRef.current = { x, y };
    // Reset stability when user taps to select new cluster
    isStableRef.current = false;
    lastChangeTimeRef.current = Date.now();
    if (__DEV__) {
      console.log(`[ROI] User tap at (${Math.round(x)}, ${Math.round(y)}) - will select nearest cluster`);
    }
  }, []);

  // Clear tap point (return to auto-selection)
  const clearTapPoint = useCallback(() => {
    userTapPointRef.current = null;
    if (__DEV__) {
      console.log('[ROI] Tap point cleared - returning to auto cluster selection');
    }
  }, []);

  return {
    updateROI,
    reset,
    getCurrentROI,
    isStable,
    setTapPoint,
    clearTapPoint,
  };
}

// =============================================================================
// HELPER: Convert OCR Result to TextBlocks
// =============================================================================

export function ocrResultToTextBlocks(ocrResult: any): TextBlock[] {
  if (!ocrResult) return [];

  const textBlocks: TextBlock[] = [];

  // ML Kit format: { resultText: string, blocks: array }
  // Each block: { blockFrame, blockCornerPoints, blockText, lines }
  // blockFrame: { x, y, width, height, boundingCenterX, boundingCenterY }

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

      // Also extract lines for finer granularity
      if (block.lines && Array.isArray(block.lines)) {
        for (const line of block.lines) {
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

  if (__DEV__ && textBlocks.length > 0) {
    console.log(`[ROI] Parsed ${textBlocks.length} text blocks with bounds`);
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
  screenHeight: number,
  orientation: 'portrait' | 'landscape' = 'portrait'
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

export default useROITracker;
