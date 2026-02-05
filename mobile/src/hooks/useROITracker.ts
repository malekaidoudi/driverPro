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

function computeBoundingBoxFromBlocks(
  blocks: TextBlock[],
  frameWidth: number,
  frameHeight: number
): BoundingBox | null {
  const validBlocks = blocks.filter(
    (b) => b.bounds && b.bounds.width > 0 && b.bounds.height > 0
  );

  if (validBlocks.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const block of validBlocks) {
    const b = block.bounds!;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }

  // Clamp to frame bounds
  minX = Math.max(0, minX);
  minY = Math.max(0, minY);
  maxX = Math.min(frameWidth, maxX);
  maxY = Math.min(frameHeight, maxY);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
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

  const updateROI = useCallback(
    (
      textBlocks: TextBlock[],
      frameWidth: number,
      frameHeight: number
    ): ROIState => {
      // Compute bounding box from detected text blocks
      const rawBox = computeBoundingBoxFromBlocks(textBlocks, frameWidth, frameHeight);

      if (!rawBox) {
        // No text detected, keep last ROI but mark as unstable
        return {
          roi: lastROIRef.current,
          isStable: false,
          confidence: 0,
        };
      }

      // Check minimum size
      if (
        rawBox.width < mergedConfig.minWidth ||
        rawBox.height < mergedConfig.minHeight
      ) {
        return {
          roi: lastROIRef.current,
          isStable: false,
          confidence: 0.2,
        };
      }

      // Add padding
      const paddedBox = addPadding(
        rawBox,
        mergedConfig.paddingPercent,
        frameWidth,
        frameHeight
      );

      // Smooth with Kalman filter
      const smoothedBox = trackerRef.current.update(paddedBox);

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

      // Compute confidence
      const confidence = scoreTextBlocks(textBlocks);

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
  }, []);

  const getCurrentROI = useCallback((): BoundingBox | null => {
    return lastROIRef.current;
  }, []);

  const isStable = useCallback((): boolean => {
    return isStableRef.current;
  }, []);

  return {
    updateROI,
    reset,
    getCurrentROI,
    isStable,
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
