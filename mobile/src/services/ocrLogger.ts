/**
 * OCR Workflow Logger
 * Dedicated logging service for tracking OCR pipeline performance
 * Logs: OCR detection, ROI processing, backend requests, responses with timing
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface OCRLogEntry {
    timestamp: number;
    phase: 'OCR' | 'ROI' | 'PARSE' | 'REQUEST' | 'RESPONSE' | 'CACHE' | 'ERROR';
    message: string;
    data?: any;
    duration?: number;
}

class OCRLogger {
    private logs: OCRLogEntry[] = [];
    private timers: Map<string, number> = new Map();
    private enabled: boolean = __DEV__;
    private maxLogs: number = 100;

    private formatTime(ms: number): string {
        if (ms < 1000) return `${ms.toFixed(0)}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    }

    private getPhaseEmoji(phase: OCRLogEntry['phase']): string {
        switch (phase) {
            case 'OCR': return '📷';
            case 'ROI': return '🎯';
            case 'PARSE': return '📝';
            case 'REQUEST': return '📤';
            case 'RESPONSE': return '📥';
            case 'CACHE': return '💾';
            case 'ERROR': return '❌';
            default: return '📋';
        }
    }

    private log(phase: OCRLogEntry['phase'], message: string, data?: any, duration?: number) {
        if (!this.enabled) return;

        const entry: OCRLogEntry = {
            timestamp: Date.now(),
            phase,
            message,
            data,
            duration,
        };

        this.logs.push(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        const emoji = this.getPhaseEmoji(phase);
        const timeStr = duration ? ` ⏱️ ${this.formatTime(duration)}` : '';
        const dataStr = data ? ` | ${JSON.stringify(data).substring(0, 100)}` : '';
        
        console.log(`[OCR-LOG] ${emoji} [${phase}] ${message}${timeStr}${dataStr}`);
    }

    // Timer functions
    startTimer(name: string) {
        this.timers.set(name, performance.now());
    }

    endTimer(name: string): number {
        const start = this.timers.get(name);
        if (!start) return 0;
        const duration = performance.now() - start;
        this.timers.delete(name);
        return duration;
    }

    // Phase-specific logging methods
    logOCRDetection(text: string, blockCount: number) {
        this.log('OCR', `Detected ${blockCount} blocks`, {
            textLength: text.length,
            preview: text.substring(0, 50),
        });
    }

    logROIProcessing(roiBlocks: number, totalBlocks: number, isStable: boolean) {
        this.log('ROI', `Filtered ${roiBlocks}/${totalBlocks} blocks | Stable: ${isStable}`, {
            roiBlocks,
            totalBlocks,
            isStable,
        });
    }

    logROIBoundingBox(box: { x: number; y: number; width: number; height: number } | null) {
        if (box) {
            this.log('ROI', `BoundingBox: ${box.width}x${box.height} at (${box.x}, ${box.y})`);
        } else {
            this.log('ROI', 'No bounding box computed');
        }
    }

    logParsing(parsed: any) {
        this.log('PARSE', 'Local parsing complete', {
            hasStreet: !!parsed?.street,
            hasCity: !!parsed?.city,
            hasPostalCode: !!parsed?.postalCode,
            hasPhone: !!parsed?.phoneNumber,
            hasName: !!parsed?.firstName || !!parsed?.lastName,
        });
    }

    logStabilityCheck(currentCount: number, threshold: number, signature: string) {
        const isStable = currentCount >= threshold;
        this.log('OCR', `Stability: ${currentCount}/${threshold} ${isStable ? '✅ STABLE' : '⏳'}`, {
            signature: signature.substring(0, 30),
        });
    }

    logCacheHit(key: string) {
        this.log('CACHE', `Cache HIT for key: ${key.substring(0, 20)}...`);
    }

    logCacheMiss(key: string) {
        this.log('CACHE', `Cache MISS for key: ${key.substring(0, 20)}...`);
    }

    logRequestStart(rawText: string) {
        this.startTimer('backend_request');
        this.log('REQUEST', 'Sending to backend', {
            textLength: rawText.length,
            preview: rawText.substring(0, 50),
        });
    }

    logRequestSuccess(response: any) {
        const duration = this.endTimer('backend_request');
        this.log('RESPONSE', `Backend response: ${response?.is_valid ? '✅ VALID' : '❌ INVALID'}`, {
            isValid: response?.is_valid,
            confidence: response?.confidence,
            method: response?.validation_method,
        }, duration);
    }

    logRequestError(error: any, isNetworkError: boolean) {
        const duration = this.endTimer('backend_request');
        this.log('ERROR', `Request failed: ${isNetworkError ? 'NETWORK' : 'SERVER'}`, {
            message: error?.message,
            isNetworkError,
        }, duration);
    }

    logValidationComplete(status: string, totalTime?: number) {
        this.log('RESPONSE', `Validation complete: ${status}`, undefined, totalTime);
    }

    // Summary methods
    getRecentLogs(count: number = 10): OCRLogEntry[] {
        return this.logs.slice(-count);
    }

    clearLogs() {
        this.logs = [];
        this.timers.clear();
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled;
    }

    // Full workflow timer
    startWorkflow() {
        this.startTimer('full_workflow');
        this.log('OCR', '🚀 OCR Workflow Started');
    }

    endWorkflow(success: boolean) {
        const duration = this.endTimer('full_workflow');
        this.log(success ? 'RESPONSE' : 'ERROR', 
            `🏁 Workflow ${success ? 'SUCCESS' : 'FAILED'}`, 
            undefined, 
            duration
        );
    }
}

// Singleton instance
export const ocrLogger = new OCRLogger();
