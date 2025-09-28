/**
 * preprocess.ts
 *
 * Early preprocessing optimizations to skip expensive pipeline operations for simple cases.
 *
 * Key optimization:
 * - Calculate total source tokens before AST parsing
 * - For small documents (≤ maxTokens), create single chunk directly
 * - Skip parseMarkdown, flattenAst, splitting, and packing operations
 * - Maintains same output format as full pipeline
 *
 * Future optimizations could include:
 * - Language detection for better tokenization
 * - Format detection (markdown vs plain text)
 * - Encoding validation
 * - Content quality heuristics
 */

import { ChunkOptions, Chunk } from './types';
import { countTokens } from './tokenizer';

export type PreprocessResult = {
  canSkipPipeline: boolean;
  sourceTokens: number;
  chunk?: Chunk;
};

/**
 * Create a single chunk directly from source content without AST processing.
 * Used for small documents that don't need complex splitting logic.
 */
function createSingleChunk(content: string, fileTitle: string): Chunk {
  const tokens = countTokens(content);

  return {
    content,
    originalText: content,
    tokens,
    tokenStats: {
      tokens,
      estimatedTokens: tokens
    },
    metadata: {
      nodeCount: 1,
      types: ['document'],
      headingTrail: [],
      headerDepths: [],
      source: fileTitle
    }
  };
}

/**
 * Preprocessing step that analyzes source content for optimization opportunities.
 *
 * Primary optimization: Early single-chunk detection
 * - If totalTokens ≤ maxTokens, return single chunk directly
 * - Avoids expensive AST parsing and processing for small documents
 *
 * @param doc - The markdown content to analyze
 * @param options - Chunking configuration options
 * @param fileTitle - Source file title for metadata
 * @returns PreprocessResult indicating whether pipeline can be skipped
 */
export function preprocess(doc: string, options: ChunkOptions, fileTitle: string): PreprocessResult {
  // Calculate total source tokens before any processing
  const sourceTokens = countTokens(doc);

  // Early single-chunk detection: skip pipeline if content fits in one chunk
  if (sourceTokens <= options.maxTokens) {
    const chunk = createSingleChunk(doc, fileTitle);

    return {
      canSkipPipeline: true,
      sourceTokens,
      chunk
    };
  }

  // Content requires complex processing - continue with full pipeline
  return {
    canSkipPipeline: false,
    sourceTokens
  };
}