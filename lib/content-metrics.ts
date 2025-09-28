/**
 * content-metrics.ts
 *
 * Simple utilities for measuring source document characteristics.
 */

import { countTokens } from './tokenizer';
import type { ChunkOptions } from './types';

export interface SourceMetrics {
  length: number;
  tokens: number;
  estimatedChunks: number;
}

/**
 * Calculate estimated number of chunks based on source tokens and options.
 *
 * @param sourceTokens - Total tokens in the source document
 * @param options - Chunking options containing maxTokens and optional targetTokens
 * @returns Estimated number of chunks (minimum 1)
 */
export function estimateChunks(sourceTokens: number, options: ChunkOptions): number {
  // If content fits within maxTokens, return 1 chunk
  if (sourceTokens <= options.maxTokens) {
    return 1;
  }

  // Use targetTokens if provided, otherwise default to 80% of maxTokens
  const targetTokens = options.targetTokens || Math.floor(options.maxTokens * 0.8);

  return Math.max(1, Math.ceil(sourceTokens / targetTokens));
}

/**
 * Calculate basic metrics for a source document.
 * These metrics are calculated early and used throughout the pipeline.
 *
 * @param sourceDocument - The markdown content to measure
 * @param options - Chunking options for estimating chunk count
 * @returns Object containing length, tokens, and estimatedChunks
 */
export function calculateSourceMetrics(sourceDocument: string, options: ChunkOptions): SourceMetrics {
  const tokens = countTokens(sourceDocument);

  return {
    // Character count - useful for:
    // - Compression ratios (chars vs tokens)
    // - Performance metrics (processing speed per character)
    // - Size validation (detecting empty or unusually large documents)
    length: sourceDocument.length,

    // Token count - useful for:
    // - Performance monitoring (comparing input vs output tokens)
    // - Estimating expected chunk count for progress reporting
    // - Optimization decisions in packing/splitting
    tokens,

    // Estimated chunk count - useful for:
    // - Progress reporting and UI feedback
    // - Resource allocation and memory planning
    // - Performance optimization decisions
    estimatedChunks: estimateChunks(tokens, options)
  };
}
