// =============================================================================
// TEMPORAL STABILIZATION FOR BOUNDING BOX
// Accumulates N frames, averages, locks when stable for X ms
// This is the "secret sauce" that makes OCR feel production-ready
// =============================================================================

import { useRef, useCallback } from 'react';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Configuration
const CONFIG = {
  HISTORY_SIZE: 6,        // Number of frames to keep in history
  STABLE_EPSILON: 8,      // Max pixel tolerance for stability check
  LOCK_TIME_MS: 350,      // Time (ms) box must be stable before locking
  UNLOCK_THRESHOLD: 25,   // Movement threshold to unlock a locked box
};

/**
 * Hook for temporal stabilization of bounding boxes
 * Accumulates history, computes weighted average, locks when stable
 */
export function useStableBox() {
  const historyRef = useRef<BoundingBox[]>([]);
  const lockedBoxRef = useRef<BoundingBox | null>(null);
  const stableSinceRef = useRef<number | null>(null);
  const lastRawBoxRef = useRef<BoundingBox | null>(null);

  /**
   * Manhattan distance between two boxes
   */
  const distance = useCallback((a: BoundingBox, b: BoundingBox): number => {
    return (
      Math.abs(a.x - b.x) +
      Math.abs(a.y - b.y) +
      Math.abs(a.width - b.width) +
      Math.abs(a.height - b.height)
    );
  }, []);

  /**
   * Weighted average of boxes (recent frames weighted more)
   */
  const weightedAverage = useCallback((boxes: BoundingBox[]): BoundingBox => {
    if (boxes.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let totalWeight = 0;
    let sumX = 0, sumY = 0, sumW = 0, sumH = 0;

    boxes.forEach((box, index) => {
      // More recent frames get higher weight (1, 2, 3, 4, 5, 6)
      const weight = index + 1;
      totalWeight += weight;
      sumX += box.x * weight;
      sumY += box.y * weight;
      sumW += box.width * weight;
      sumH += box.height * weight;
    });

    return {
      x: Math.round(sumX / totalWeight),
      y: Math.round(sumY / totalWeight),
      width: Math.round(sumW / totalWeight),
      height: Math.round(sumH / totalWeight),
    };
  }, []);

  /**
   * Update with new box, returns stabilized result
   */
  const update = useCallback((rawBox: BoundingBox | null): BoundingBox | null => {
    // No box detected - reset everything
    if (!rawBox) {
      historyRef.current = [];
      lockedBoxRef.current = null;
      stableSinceRef.current = null;
      lastRawBoxRef.current = null;
      return null;
    }

    lastRawBoxRef.current = rawBox;

    // Add to history (FIFO)
    historyRef.current.push(rawBox);
    if (historyRef.current.length > CONFIG.HISTORY_SIZE) {
      historyRef.current.shift();
    }

    // Need at least 3 frames for meaningful average
    if (historyRef.current.length < 3) {
      return rawBox;
    }

    // Compute weighted average
    const avgBox = weightedAverage(historyRef.current);

    // Check if all recent boxes are within tolerance of average
    const isStable = historyRef.current.every(
      (box) => distance(box, avgBox) < CONFIG.STABLE_EPSILON
    );

    const now = Date.now();

    if (isStable) {
      // Start stability timer if not already started
      if (stableSinceRef.current === null) {
        stableSinceRef.current = now;
      }

      // Check if stable long enough to lock
      const stableDuration = now - stableSinceRef.current;
      if (stableDuration >= CONFIG.LOCK_TIME_MS) {
        lockedBoxRef.current = avgBox;
        
        if (__DEV__ && !lockedBoxRef.current) {
          console.log(`[STABLE] Locked box after ${stableDuration}ms`);
        }
      }
    } else {
      // Not stable - check if we need to unlock
      if (lockedBoxRef.current) {
        const movementFromLocked = distance(avgBox, lockedBoxRef.current);
        if (movementFromLocked > CONFIG.UNLOCK_THRESHOLD) {
          // Significant movement - unlock
          lockedBoxRef.current = null;
          stableSinceRef.current = null;
          
          if (__DEV__) {
            console.log(`[STABLE] Unlocked - movement=${Math.round(movementFromLocked)}px`);
          }
        }
      } else {
        stableSinceRef.current = null;
      }
    }

    // Return locked box if available, otherwise return smoothed average
    return lockedBoxRef.current ?? avgBox;
  }, [distance, weightedAverage]);

  /**
   * Check if box is currently locked (stable)
   */
  const isLocked = useCallback((): boolean => {
    return lockedBoxRef.current !== null;
  }, []);

  /**
   * Force reset all state
   */
  const reset = useCallback(() => {
    historyRef.current = [];
    lockedBoxRef.current = null;
    stableSinceRef.current = null;
    lastRawBoxRef.current = null;
  }, []);

  return {
    update,
    isLocked,
    reset,
  };
}

export default useStableBox;
