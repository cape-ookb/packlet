/**
 * content-metrics.ts
 *
 * Simple utilities for measuring source document characteristics.
 */

import { countTokens } from './tokenizer';

export interface SourceMetrics {
  sourceLength: number;
  sourceTokens: number;
}

/**
 * Calculate basic metrics for a source document.
 * These metrics are calculated early and used throughout the pipeline.
 *
 * @param sourceDocument - The markdown content to measure
 * @returns Object containing sourceLength and sourceTokens
 */
export function calculateSourceMetrics(sourceDocument: string): SourceMetrics {
  return {
    // Character count - useful for:
    // - Compression ratios (chars vs tokens)
    // - Performance metrics (processing speed per character)
    // - Size validation (detecting empty or unusually large documents)
    sourceLength: sourceDocument.length,

    // Token count - useful for:
    // - Performance monitoring (comparing input vs output tokens)
    // - Estimating expected chunk count for progress reporting
    // - Optimization decisions in packing/splitting
    sourceTokens: countTokens(sourceDocument)
  };
}

