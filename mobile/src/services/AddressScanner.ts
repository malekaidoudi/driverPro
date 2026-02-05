// =============================================================================
// DYNAMIC ADAPTIVE ROI ADDRESS SCANNER
// Real-time text region detection and tracking for OCR optimization
// =============================================================================

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextRegion {
  box: BoundingBox;
  confidence: number;
  density: number;
  lineCount: number;
}

export interface ScannerConfig {
  minRegionWidth: number;
  minRegionHeight: number;
  paddingPercent: number;
  smoothingFactor: number;
  stabilityThresholdMs: number;
  stabilityMovementThreshold: number;
  ocrThrottleMs: number;
  edgeThreshold: number;
  contrastThreshold: number;
  minTextDensity: number;
  maxRegionsToProcess: number;
  frameSkip: number;
}

export interface ScanResult {
  text: string;
  confidence: number;
  roi: BoundingBox;
  timestamp: number;
}

type OCRCallback = (imageData: ImageData, roi: BoundingBox) => Promise<ScanResult | null>;
type ROIUpdateCallback = (roi: BoundingBox | null, isStable: boolean) => void;

const DEFAULT_CONFIG: ScannerConfig = {
  minRegionWidth: 100,
  minRegionHeight: 60,
  paddingPercent: 0.1,
  smoothingFactor: 0.15,
  stabilityThresholdMs: 500,
  stabilityMovementThreshold: 8,
  ocrThrottleMs: 800,
  edgeThreshold: 30,
  contrastThreshold: 40,
  minTextDensity: 0.15,
  maxRegionsToProcess: 20,
  frameSkip: 2,
};

// =============================================================================
// KALMAN FILTER FOR SMOOTH TRACKING
// =============================================================================

class KalmanFilter1D {
  private q: number; // process noise
  private r: number; // measurement noise
  private x: number; // estimated value
  private p: number; // estimation error covariance
  private k: number; // Kalman gain

  constructor(q: number = 0.1, r: number = 1, initialValue: number = 0) {
    this.q = q;
    this.r = r;
    this.x = initialValue;
    this.p = 1;
    this.k = 0;
  }

  update(measurement: number): number {
    // Prediction
    this.p = this.p + this.q;

    // Update
    this.k = this.p / (this.p + this.r);
    this.x = this.x + this.k * (measurement - this.x);
    this.p = (1 - this.k) * this.p;

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

class BoundingBoxTracker {
  private xFilter: KalmanFilter1D;
  private yFilter: KalmanFilter1D;
  private wFilter: KalmanFilter1D;
  private hFilter: KalmanFilter1D;
  private initialized: boolean = false;

  constructor(processNoise: number = 0.05, measurementNoise: number = 2) {
    this.xFilter = new KalmanFilter1D(processNoise, measurementNoise);
    this.yFilter = new KalmanFilter1D(processNoise, measurementNoise);
    this.wFilter = new KalmanFilter1D(processNoise, measurementNoise);
    this.hFilter = new KalmanFilter1D(processNoise, measurementNoise);
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
// IMAGE PROCESSING UTILITIES
// =============================================================================

function createGrayscaleBuffer(imageData: ImageData): Uint8Array {
  const { data, width, height } = imageData;
  const gray = new Uint8Array(width * height);

  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
  }

  return gray;
}

function computeSobelEdges(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Sobel kernels
      const gx =
        -gray[(y - 1) * width + (x - 1)] +
        gray[(y - 1) * width + (x + 1)] -
        2 * gray[y * width + (x - 1)] +
        2 * gray[y * width + (x + 1)] -
        gray[(y + 1) * width + (x - 1)] +
        gray[(y + 1) * width + (x + 1)];

      const gy =
        -gray[(y - 1) * width + (x - 1)] -
        2 * gray[(y - 1) * width + x] -
        gray[(y - 1) * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] +
        2 * gray[(y + 1) * width + x] +
        gray[(y + 1) * width + (x + 1)];

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[idx] = magnitude > threshold ? 255 : 0;
    }
  }

  return edges;
}

function computeLocalContrast(
  gray: Uint8Array,
  width: number,
  height: number,
  blockSize: number = 16
): Float32Array {
  const blocksX = Math.ceil(width / blockSize);
  const blocksY = Math.ceil(height / blockSize);
  const contrast = new Float32Array(blocksX * blocksY);

  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      let min = 255;
      let max = 0;

      const startX = bx * blockSize;
      const startY = by * blockSize;
      const endX = Math.min(startX + blockSize, width);
      const endY = Math.min(startY + blockSize, height);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const val = gray[y * width + x];
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }

      contrast[by * blocksX + bx] = max - min;
    }
  }

  return contrast;
}

function findHorizontalLineSegments(
  edges: Uint8Array,
  width: number,
  height: number,
  minLength: number = 20
): Array<{ y: number; x1: number; x2: number }> {
  const segments: Array<{ y: number; x1: number; x2: number }> = [];

  for (let y = 0; y < height; y++) {
    let inSegment = false;
    let startX = 0;

    for (let x = 0; x < width; x++) {
      const isEdge = edges[y * width + x] > 0;

      if (isEdge && !inSegment) {
        inSegment = true;
        startX = x;
      } else if (!isEdge && inSegment) {
        inSegment = false;
        if (x - startX >= minLength) {
          segments.push({ y, x1: startX, x2: x });
        }
      }
    }

    if (inSegment && width - startX >= minLength) {
      segments.push({ y, x1: startX, x2: width });
    }
  }

  return segments;
}

function clusterLineSegments(
  segments: Array<{ y: number; x1: number; x2: number }>,
  maxGapY: number = 30,
  minOverlapX: number = 0.3
): BoundingBox[] {
  if (segments.length === 0) return [];

  const sorted = [...segments].sort((a, b) => a.y - b.y);
  const clusters: Array<Array<{ y: number; x1: number; x2: number }>> = [];
  let currentCluster: Array<{ y: number; x1: number; x2: number }> = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentCluster[currentCluster.length - 1];
    const curr = sorted[i];

    const yGap = curr.y - prev.y;
    const overlapStart = Math.max(prev.x1, curr.x1);
    const overlapEnd = Math.min(prev.x2, curr.x2);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    const minWidth = Math.min(prev.x2 - prev.x1, curr.x2 - curr.x1);
    const overlapRatio = minWidth > 0 ? overlap / minWidth : 0;

    if (yGap <= maxGapY && overlapRatio >= minOverlapX) {
      currentCluster.push(curr);
    } else {
      if (currentCluster.length >= 2) {
        clusters.push(currentCluster);
      }
      currentCluster = [curr];
    }
  }

  if (currentCluster.length >= 2) {
    clusters.push(currentCluster);
  }

  return clusters.map((cluster) => {
    const minX = Math.min(...cluster.map((s) => s.x1));
    const maxX = Math.max(...cluster.map((s) => s.x2));
    const minY = Math.min(...cluster.map((s) => s.y));
    const maxY = Math.max(...cluster.map((s) => s.y));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY + 10,
    };
  });
}

function computeTextDensity(
  edges: Uint8Array,
  width: number,
  height: number,
  box: BoundingBox
): number {
  let edgeCount = 0;
  let totalPixels = 0;

  const startX = Math.max(0, box.x);
  const startY = Math.max(0, box.y);
  const endX = Math.min(width, box.x + box.width);
  const endY = Math.min(height, box.y + box.height);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      totalPixels++;
      if (edges[y * width + x] > 0) {
        edgeCount++;
      }
    }
  }

  return totalPixels > 0 ? edgeCount / totalPixels : 0;
}

function scoreTextRegion(
  region: BoundingBox,
  edges: Uint8Array,
  contrast: Float32Array,
  width: number,
  height: number,
  blockSize: number,
  config: ScannerConfig
): TextRegion {
  const density = computeTextDensity(edges, width, height, region);

  // Count high contrast blocks within region
  const blocksX = Math.ceil(width / blockSize);
  const startBX = Math.floor(region.x / blockSize);
  const startBY = Math.floor(region.y / blockSize);
  const endBX = Math.ceil((region.x + region.width) / blockSize);
  const endBY = Math.ceil((region.y + region.height) / blockSize);

  let highContrastBlocks = 0;
  let totalBlocks = 0;

  for (let by = startBY; by < endBY && by < Math.ceil(height / blockSize); by++) {
    for (let bx = startBX; bx < endBX && bx < blocksX; bx++) {
      totalBlocks++;
      if (contrast[by * blocksX + bx] > config.contrastThreshold) {
        highContrastBlocks++;
      }
    }
  }

  const contrastScore = totalBlocks > 0 ? highContrastBlocks / totalBlocks : 0;

  // Estimate line count based on region height and typical text line height
  const estimatedLineHeight = 20;
  const lineCount = Math.round(region.height / estimatedLineHeight);

  // Combined confidence score
  const densityScore = Math.min(density / config.minTextDensity, 1);
  const sizeScore = Math.min(
    (region.width * region.height) / (config.minRegionWidth * config.minRegionHeight * 4),
    1
  );
  const lineScore = Math.min(lineCount / 3, 1);

  const confidence =
    densityScore * 0.3 + contrastScore * 0.3 + sizeScore * 0.2 + lineScore * 0.2;

  return {
    box: region,
    confidence,
    density,
    lineCount,
  };
}

function mergeOverlappingBoxes(boxes: BoundingBox[], overlapThreshold: number = 0.3): BoundingBox[] {
  if (boxes.length <= 1) return boxes;

  const merged: BoundingBox[] = [];
  const used = new Set<number>();

  for (let i = 0; i < boxes.length; i++) {
    if (used.has(i)) continue;

    let current = { ...boxes[i] };
    used.add(i);

    let merged_any = true;
    while (merged_any) {
      merged_any = false;

      for (let j = 0; j < boxes.length; j++) {
        if (used.has(j)) continue;

        const other = boxes[j];

        // Calculate overlap
        const overlapX = Math.max(
          0,
          Math.min(current.x + current.width, other.x + other.width) -
            Math.max(current.x, other.x)
        );
        const overlapY = Math.max(
          0,
          Math.min(current.y + current.height, other.y + other.height) -
            Math.max(current.y, other.y)
        );
        const overlapArea = overlapX * overlapY;
        const minArea = Math.min(
          current.width * current.height,
          other.width * other.height
        );

        if (overlapArea / minArea > overlapThreshold) {
          // Merge boxes
          const newX = Math.min(current.x, other.x);
          const newY = Math.min(current.y, other.y);
          current = {
            x: newX,
            y: newY,
            width: Math.max(current.x + current.width, other.x + other.width) - newX,
            height: Math.max(current.y + current.height, other.y + other.height) - newY,
          };
          used.add(j);
          merged_any = true;
        }
      }
    }

    merged.push(current);
  }

  return merged;
}

function addPadding(box: BoundingBox, paddingPercent: number, maxWidth: number, maxHeight: number): BoundingBox {
  const padX = Math.round(box.width * paddingPercent);
  const padY = Math.round(box.height * paddingPercent);

  return {
    x: Math.max(0, box.x - padX),
    y: Math.max(0, box.y - padY),
    width: Math.min(maxWidth - Math.max(0, box.x - padX), box.width + padX * 2),
    height: Math.min(maxHeight - Math.max(0, box.y - padY), box.height + padY * 2),
  };
}

function boxDistance(a: BoundingBox, b: BoundingBox): number {
  const dx = Math.abs(a.x - b.x) + Math.abs(a.width - b.width);
  const dy = Math.abs(a.y - b.y) + Math.abs(a.height - b.height);
  return dx + dy;
}

// =============================================================================
// ADDRESS SCANNER CLASS
// =============================================================================

export class AddressScanner {
  private config: ScannerConfig;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private frameCount: number = 0;

  private tracker: BoundingBoxTracker;
  private currentROI: BoundingBox | null = null;
  private lastStableROI: BoundingBox | null = null;
  private lastROIChangeTime: number = 0;
  private lastOCRTime: number = 0;
  private isStable: boolean = false;

  private onOCR: OCRCallback | null = null;
  private onROIUpdate: ROIUpdateCallback | null = null;

  // Reusable buffers
  private grayBuffer: Uint8Array | null = null;
  private edgeBuffer: Uint8Array | null = null;
  private contrastBuffer: Float32Array | null = null;
  private lastWidth: number = 0;
  private lastHeight: number = 0;

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.tracker = new BoundingBoxTracker();

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  setOCRCallback(callback: OCRCallback): void {
    this.onOCR = callback;
  }

  setROIUpdateCallback(callback: ROIUpdateCallback): void {
    this.onROIUpdate = callback;
  }

  async start(videoElement: HTMLVideoElement): Promise<void> {
    if (this.isRunning) {
      this.stop();
    }

    this.videoElement = videoElement;
    this.isRunning = true;
    this.frameCount = 0;
    this.tracker.reset();
    this.currentROI = null;
    this.lastStableROI = null;
    this.lastROIChangeTime = performance.now();
    this.lastOCRTime = 0;
    this.isStable = false;

    this.processLoop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.videoElement = null;
    this.currentROI = null;
    this.tracker.reset();
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCurrentROI(): BoundingBox | null {
    return this.currentROI;
  }

  isROIStable(): boolean {
    return this.isStable;
  }

  private processLoop = (): void => {
    if (!this.isRunning || !this.videoElement) return;

    this.frameCount++;

    // Skip frames for performance
    if (this.frameCount % this.config.frameSkip === 0) {
      this.processFrame();
    }

    this.animationFrameId = requestAnimationFrame(this.processLoop);
  };

  processFrame(): void {
    if (!this.videoElement || this.videoElement.readyState < 2) return;

    const video = this.videoElement;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) return;

    // Resize canvas if needed
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.allocateBuffers(width, height);
    }

    // Draw frame to canvas
    this.ctx.drawImage(video, 0, 0);
    const imageData = this.ctx.getImageData(0, 0, width, height);

    // Detect text regions
    const regions = this.detectTextRegions(imageData);

    // Select best region
    const bestRegion = this.selectBestRegion(regions);

    if (bestRegion) {
      // Add padding
      const paddedBox = addPadding(
        bestRegion.box,
        this.config.paddingPercent,
        width,
        height
      );

      // Smooth the bounding box
      const smoothedBox = this.smoothBoundingBox(paddedBox);
      this.currentROI = smoothedBox;

      // Check stability
      this.updateStability(smoothedBox);

      // Notify ROI update
      if (this.onROIUpdate) {
        this.onROIUpdate(this.currentROI, this.isStable);
      }

      // Trigger OCR if stable and throttled
      if (this.isStable && this.shouldTriggerOCR()) {
        this.triggerOCR(imageData);
      }
    } else {
      // No region detected, decay current ROI
      if (this.currentROI) {
        this.isStable = false;
        if (this.onROIUpdate) {
          this.onROIUpdate(this.currentROI, false);
        }
      }
    }
  }

  private allocateBuffers(width: number, height: number): void {
    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.grayBuffer = new Uint8Array(width * height);
      this.edgeBuffer = new Uint8Array(width * height);
      const blockSize = 16;
      const blocksX = Math.ceil(width / blockSize);
      const blocksY = Math.ceil(height / blockSize);
      this.contrastBuffer = new Float32Array(blocksX * blocksY);
      this.lastWidth = width;
      this.lastHeight = height;
    }
  }

  detectTextRegions(imageData: ImageData): TextRegion[] {
    const { width, height } = imageData;
    const blockSize = 16;

    // Convert to grayscale
    const gray = createGrayscaleBuffer(imageData);

    // Compute edges
    const edges = computeSobelEdges(gray, width, height, this.config.edgeThreshold);

    // Compute local contrast
    const contrast = computeLocalContrast(gray, width, height, blockSize);

    // Find horizontal line segments (text lines)
    const segments = findHorizontalLineSegments(edges, width, height, 15);

    // Cluster segments into text blocks
    const clusters = clusterLineSegments(segments, 25, 0.2);

    // Merge overlapping boxes
    const mergedBoxes = mergeOverlappingBoxes(clusters, 0.2);

    // Filter by minimum size
    const validBoxes = mergedBoxes.filter(
      (box) =>
        box.width >= this.config.minRegionWidth &&
        box.height >= this.config.minRegionHeight
    );

    // Score each region
    const regions: TextRegion[] = validBoxes
      .slice(0, this.config.maxRegionsToProcess)
      .map((box) => scoreTextRegion(box, edges, contrast, width, height, blockSize, this.config))
      .filter((region) => region.density >= this.config.minTextDensity * 0.5);

    return regions;
  }

  private selectBestRegion(regions: TextRegion[]): TextRegion | null {
    if (regions.length === 0) return null;

    // Sort by confidence
    const sorted = [...regions].sort((a, b) => b.confidence - a.confidence);

    // Prefer regions with 3-6 lines (typical address)
    const idealLineCount = sorted.filter(
      (r) => r.lineCount >= 3 && r.lineCount <= 8
    );

    if (idealLineCount.length > 0) {
      return idealLineCount[0];
    }

    return sorted[0];
  }

  private smoothBoundingBox(box: BoundingBox): BoundingBox {
    return this.tracker.update(box);
  }

  computeBoundingBox(regions: TextRegion[]): BoundingBox | null {
    if (regions.length === 0) return null;

    const boxes = regions.map((r) => r.box);

    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.width));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private updateStability(box: BoundingBox): void {
    const now = performance.now();

    if (this.lastStableROI) {
      const distance = boxDistance(box, this.lastStableROI);

      if (distance > this.config.stabilityMovementThreshold) {
        this.lastROIChangeTime = now;
        this.isStable = false;
      } else {
        const stableDuration = now - this.lastROIChangeTime;
        this.isStable = stableDuration >= this.config.stabilityThresholdMs;
      }
    } else {
      this.lastROIChangeTime = now;
      this.isStable = false;
    }

    this.lastStableROI = { ...box };
  }

  private shouldTriggerOCR(): boolean {
    const now = performance.now();
    return now - this.lastOCRTime >= this.config.ocrThrottleMs;
  }

  private async triggerOCR(imageData: ImageData): Promise<void> {
    if (!this.onOCR || !this.currentROI) return;

    this.lastOCRTime = performance.now();

    const croppedData = this.cropROI(imageData, this.currentROI);
    if (croppedData) {
      try {
        await this.onOCR(croppedData, this.currentROI);
      } catch (error) {
        console.error('OCR callback error:', error);
      }
    }
  }

  cropROI(imageData: ImageData, roi: BoundingBox): ImageData | null {
    const { width, height } = imageData;

    // Clamp ROI to image bounds
    const x = Math.max(0, Math.min(roi.x, width - 1));
    const y = Math.max(0, Math.min(roi.y, height - 1));
    const w = Math.min(roi.width, width - x);
    const h = Math.min(roi.height, height - y);

    if (w <= 0 || h <= 0) return null;

    // Resize offscreen canvas
    if (this.offscreenCanvas.width !== w || this.offscreenCanvas.height !== h) {
      this.offscreenCanvas.width = w;
      this.offscreenCanvas.height = h;
    }

    // Put original image data on main canvas if not already there
    this.ctx.putImageData(imageData, 0, 0);

    // Draw cropped region to offscreen canvas
    this.offscreenCtx.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);

    return this.offscreenCtx.getImageData(0, 0, w, h);
  }

  sendToOCR(imageData: ImageData, roi: BoundingBox): Promise<ScanResult | null> {
    if (!this.onOCR) {
      return Promise.resolve(null);
    }
    return this.onOCR(imageData, roi);
  }

  // Manual frame processing for external control
  processVideoFrame(video: HTMLVideoElement): {
    roi: BoundingBox | null;
    isStable: boolean;
    regions: TextRegion[];
  } {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) {
      return { roi: null, isStable: false, regions: [] };
    }

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.allocateBuffers(width, height);
    }

    this.ctx.drawImage(video, 0, 0);
    const imageData = this.ctx.getImageData(0, 0, width, height);

    const regions = this.detectTextRegions(imageData);
    const bestRegion = this.selectBestRegion(regions);

    if (bestRegion) {
      const paddedBox = addPadding(
        bestRegion.box,
        this.config.paddingPercent,
        width,
        height
      );
      const smoothedBox = this.smoothBoundingBox(paddedBox);
      this.currentROI = smoothedBox;
      this.updateStability(smoothedBox);
    }

    return {
      roi: this.currentROI,
      isStable: this.isStable,
      regions,
    };
  }

  // Get cropped image as base64 for OCR
  getCroppedImageBase64(video: HTMLVideoElement, roi: BoundingBox): string | null {
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width === 0 || height === 0) return null;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    this.ctx.drawImage(video, 0, 0);

    const x = Math.max(0, Math.min(roi.x, width - 1));
    const y = Math.max(0, Math.min(roi.y, height - 1));
    const w = Math.min(roi.width, width - x);
    const h = Math.min(roi.height, height - y);

    if (w <= 0 || h <= 0) return null;

    this.offscreenCanvas.width = w;
    this.offscreenCanvas.height = h;
    this.offscreenCtx.drawImage(this.canvas, x, y, w, h, 0, 0, w, h);

    return this.offscreenCanvas.toDataURL('image/png');
  }

  // Debug: draw ROI overlay on canvas
  drawDebugOverlay(
    targetCanvas: HTMLCanvasElement,
    video: HTMLVideoElement
  ): void {
    const ctx = targetCanvas.getContext('2d');
    if (!ctx) return;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (targetCanvas.width !== width || targetCanvas.height !== height) {
      targetCanvas.width = width;
      targetCanvas.height = height;
    }

    ctx.drawImage(video, 0, 0);

    if (this.currentROI) {
      const roi = this.currentROI;

      // Draw semi-transparent overlay outside ROI
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, width, roi.y); // top
      ctx.fillRect(0, roi.y + roi.height, width, height - roi.y - roi.height); // bottom
      ctx.fillRect(0, roi.y, roi.x, roi.height); // left
      ctx.fillRect(roi.x + roi.width, roi.y, width - roi.x - roi.width, roi.height); // right

      // Draw ROI border
      ctx.strokeStyle = this.isStable ? '#00ff00' : '#ffff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(roi.x, roi.y, roi.width, roi.height);

      // Draw corners
      const cornerSize = 20;
      ctx.strokeStyle = this.isStable ? '#00ff00' : '#ffff00';
      ctx.lineWidth = 4;

      // Top-left
      ctx.beginPath();
      ctx.moveTo(roi.x, roi.y + cornerSize);
      ctx.lineTo(roi.x, roi.y);
      ctx.lineTo(roi.x + cornerSize, roi.y);
      ctx.stroke();

      // Top-right
      ctx.beginPath();
      ctx.moveTo(roi.x + roi.width - cornerSize, roi.y);
      ctx.lineTo(roi.x + roi.width, roi.y);
      ctx.lineTo(roi.x + roi.width, roi.y + cornerSize);
      ctx.stroke();

      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(roi.x, roi.y + roi.height - cornerSize);
      ctx.lineTo(roi.x, roi.y + roi.height);
      ctx.lineTo(roi.x + cornerSize, roi.y + roi.height);
      ctx.stroke();

      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(roi.x + roi.width - cornerSize, roi.y + roi.height);
      ctx.lineTo(roi.x + roi.width, roi.y + roi.height);
      ctx.lineTo(roi.x + roi.width, roi.y + roi.height - cornerSize);
      ctx.stroke();

      // Status text
      ctx.fillStyle = this.isStable ? '#00ff00' : '#ffff00';
      ctx.font = '16px monospace';
      ctx.fillText(
        this.isStable ? '✓ STABLE - Scanning...' : '◎ Detecting...',
        roi.x,
        roi.y - 10
      );
    }
  }

  updateConfig(config: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): ScannerConfig {
    return { ...this.config };
  }
}

// =============================================================================
// REACT NATIVE COMPATIBLE HOOK
// =============================================================================

export function useAddressScanner(config?: Partial<ScannerConfig>) {
  const scanner = new AddressScanner(config);

  return {
    scanner,
    start: scanner.start.bind(scanner),
    stop: scanner.stop.bind(scanner),
    processFrame: scanner.processFrame.bind(scanner),
    detectTextRegions: scanner.detectTextRegions.bind(scanner),
    computeBoundingBox: scanner.computeBoundingBox.bind(scanner),
    cropROI: scanner.cropROI.bind(scanner),
    sendToOCR: scanner.sendToOCR.bind(scanner),
    getCurrentROI: scanner.getCurrentROI.bind(scanner),
    isROIStable: scanner.isROIStable.bind(scanner),
    setOCRCallback: scanner.setOCRCallback.bind(scanner),
    setROIUpdateCallback: scanner.setROIUpdateCallback.bind(scanner),
  };
}

export default AddressScanner;
