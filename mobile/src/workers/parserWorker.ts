// =============================================================================
// PARSER WORKER - Off-thread parsing for React Native
// Uses microtask scheduling to avoid blocking UI thread
// =============================================================================

import { parseOCRText, ParsedAddress } from '../hooks/useOCRParsing';

type ParseJob = {
  id: number;
  text: string;
  resolve: (result: ParsedAddress) => void;
  reject: (error: Error) => void;
};

// Job queue
const jobQueue: ParseJob[] = [];
let isProcessing = false;
let jobIdCounter = 0;

// Process jobs in microtasks to avoid blocking UI
async function processQueue(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) return;
  
  isProcessing = true;
  
  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (!job) continue;
    
    try {
      // Yield to UI thread before heavy parsing
      await yieldToMain();
      
      // Parse text
      const result = parseOCRText(job.text);
      
      // Yield again before resolving
      await yieldToMain();
      
      job.resolve(result);
    } catch (error) {
      job.reject(error as Error);
    }
  }
  
  isProcessing = false;
}

// Yield to main thread using setTimeout(0)
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * Queue text for parsing on a "virtual worker" thread.
 * Returns a promise that resolves with the parsed result.
 * This avoids blocking the UI thread during heavy regex operations.
 */
export function parseAsync(text: string): Promise<ParsedAddress> {
  return new Promise((resolve, reject) => {
    const job: ParseJob = {
      id: jobIdCounter++,
      text,
      resolve,
      reject,
    };
    
    jobQueue.push(job);
    
    // Start processing (will be no-op if already processing)
    processQueue();
  });
}

/**
 * Cancel all pending parse jobs.
 * Useful when scanner closes or resets.
 */
export function cancelAllJobs(): void {
  jobQueue.length = 0;
}

/**
 * Get current queue length (for debugging).
 */
export function getQueueLength(): number {
  return jobQueue.length;
}
