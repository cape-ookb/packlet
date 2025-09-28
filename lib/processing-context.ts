/**
 * processing-context.ts
 *
 * Unified context object that flows through the entire chunking pipeline.
 * Eliminates parameter passing duplication and provides single source of truth
 * for all processing state, configuration, and intermediate results.
 */

import { Chunk, ChunkOptions } from './types';
import { FlatNode } from './flatten-ast';
import type { ContentAnalysis } from './content-analysis/types';

/**
 * Processing stage indicators for pipeline flow control
 */
export type ProcessingStage =
  | 'initialized'        // Context created with input data
  | 'preprocessed'       // Preprocessing analysis completed
  | 'parsed'             // Markdown parsed to AST (multi-chunk only)
  | 'flattened'          // AST flattened to nodes (multi-chunk only)
  | 'split'              // Oversized nodes split (multi-chunk only)
  | 'packed'             // Nodes packed into chunks (multi-chunk only)
  | 'overlapped'         // Overlap added between chunks
  | 'normalized'         // Text normalized and cleaned
  | 'metadata_attached'  // Metadata and IDs attached
  | 'embed_text_added'   // EmbedText generated
  | 'validated'          // Quality validation completed
  | 'completed';         // Processing finished, ready for stats

/**
 * Processing path determination
 */
export type ProcessingPath = 'single-chunk' | 'multi-chunk' | 'undetermined';

/**
 * Comprehensive timing information for performance analysis
 */
export type ProcessingTiming = {
  /** Overall processing start time */
  startTime: number;

  /** Overall processing end time */
  endTime?: number;

  /** Total processing duration in milliseconds */
  totalDurationMs?: number;

  /** Performance metrics for each pipeline stage */
  stageMetrics: Partial<Record<ProcessingStage, {
    startTime: number;
    endTime?: number;
    durationMs?: number;
  }>>;
};

/**
 * Content size and token metrics
 */
export type ContentMetrics = {
  /** Total source document length in characters */
  sourceLength: number;

  /** Total tokens in source document (from preprocessing) */
  sourceTokens?: number;

  /** Estimated vs actual token counts */
  tokenEstimates?: {
    estimated: number;
    actual: number;
    compressionRatio: number; // actual/estimated
  };

  /** Basic content structure metrics */
  structure?: {
    headingCount: number;
    paragraphCount: number;
    codeBlockCount: number;
    listCount: number;
    tableCount: number;
  };

  /** Detailed content analysis (from content-analysis system) */
  analysis?: ContentAnalysis;
};

/**
 * Chunk processing state and results
 */
export type ChunkData = {
  /** Current chunks being processed */
  chunks: Chunk[];

  /** Final chunk count */
  finalChunkCount?: number;

  /** Chunk quality metrics */
  quality?: {
    chunksUnderTarget: number;
    chunksAtTarget: number;
    chunksOverTarget: number;
    qualityFlags: Array<{
      chunkIndex: number;
      issue: string;
      severity: 'warning' | 'error';
    }>;
  };
};

/**
 * Preprocessing analysis results
 */
export type PreprocessingData = {
  /** Whether pipeline can be skipped (single chunk optimization) */
  canSkipPipeline: boolean;

  /** Pre-created chunk for single-chunk optimization */
  singleChunk?: Chunk;

  /** Early processing estimates */
  estimates?: {
    estimatedChunks: number;
    recommendedPath: ProcessingPath;
  };
};

/**
 * Error tracking and recovery information
 */
export type ErrorTracking = {
  /** Processing errors encountered */
  errors: Array<{
    stage: ProcessingStage;
    error: Error;
    recoverable: boolean;
    timestamp: number;
  }>;

  /** Recovery actions taken */
  recoveries?: Array<{
    fromStage: ProcessingStage;
    action: string;
    successful: boolean;
  }>;
};

/**
 * Comprehensive context object that flows through the entire pipeline.
 * Contains all input data, configuration, intermediate state, and results.
 */
export type ProcessingContext = {
  // === Input Data ===
  /** Original markdown document content */
  readonly sourceDocument: string;

  /** Source file title/name for metadata and breadcrumbs */
  readonly fileTitle: string;

  /** Chunking configuration with defaults applied */
  readonly options: ChunkOptions;

  // === Processing Control ===
  /** Current stage in the processing pipeline */
  stage: ProcessingStage;

  /** Processing path: single-chunk optimization vs full pipeline */
  path: ProcessingPath;

  // === Structured Data Categories ===
  /** All timing and performance metrics */
  timing: ProcessingTiming;

  /** Content size and token analysis */
  content: ContentMetrics;

  /** Chunk processing state and results */
  chunks: ChunkData;

  /** Preprocessing analysis and optimization */
  preprocessing?: PreprocessingData;

  // === Intermediate Pipeline Data ===
  /** AST nodes (multi-chunk path only) */
  nodes?: FlatNode[];

  // === Error Handling ===
  /** Error tracking and recovery */
  errors?: ErrorTracking;
};

/**
 * Create initial processing context from input parameters
 */
export function createProcessingContext(
  sourceDocument: string,
  fileTitle: string,
  options: ChunkOptions
): ProcessingContext {
  const startTime = performance.now();

  return {
    sourceDocument,
    fileTitle,
    options,
    stage: 'initialized',
    path: 'undetermined',
    timing: {
      startTime,
      stageMetrics: {
        initialized: { startTime }
      }
    },
    content: {
      sourceLength: sourceDocument.length
    },
    chunks: {
      chunks: []
    }
  };
}

/**
 * Transition context to next processing stage with timing
 */
export function transitionStage(
  context: ProcessingContext,
  nextStage: ProcessingStage
): ProcessingContext {
  const now = performance.now();

  // Complete timing for current stage
  const currentStageMetric = context.timing.stageMetrics[context.stage];
  if (currentStageMetric && !currentStageMetric.endTime) {
    currentStageMetric.endTime = now;
    currentStageMetric.durationMs = now - currentStageMetric.startTime;
  }

  // Start timing for new stage
  const updatedStageMetrics = {
    ...context.timing.stageMetrics,
    [nextStage]: { startTime: now }
  };

  return {
    ...context,
    stage: nextStage,
    timing: {
      ...context.timing,
      stageMetrics: updatedStageMetrics
    }
  };
}

/**
 * Complete processing by recording final timing
 */
export function completeProcessing(context: ProcessingContext): ProcessingContext {
  const endTime = performance.now();

  // Complete final stage timing
  const finalContext = transitionStage(context, 'completed');

  return {
    ...finalContext,
    timing: {
      ...finalContext.timing,
      endTime,
      totalDurationMs: endTime - finalContext.timing.startTime
    },
    chunks: {
      ...finalContext.chunks,
      finalChunkCount: finalContext.chunks.chunks.length
    }
  };
}

/**
 * Add error to context with recovery information
 */
export function addError(
  context: ProcessingContext,
  error: Error,
  recoverable: boolean = false
): ProcessingContext {
  const existingErrors = context.errors?.errors || [];

  return {
    ...context,
    errors: {
      errors: [
        ...existingErrors,
        {
          stage: context.stage,
          error,
          recoverable,
          timestamp: performance.now()
        }
      ]
    }
  };
}

/**
 * Update content metrics in context
 */
export function updateContentMetrics(
  context: ProcessingContext,
  updates: Partial<ContentMetrics>
): ProcessingContext {
  return {
    ...context,
    content: {
      ...context.content,
      ...updates
    }
  };
}

/**
 * Update preprocessing data in context
 */
export function updatePreprocessing(
  context: ProcessingContext,
  data: PreprocessingData
): ProcessingContext {
  return {
    ...context,
    preprocessing: data,
    path: data.canSkipPipeline ? 'single-chunk' : 'multi-chunk'
  };
}

/**
 * Update chunks in context
 */
export function updateChunks(
  context: ProcessingContext,
  chunks: Chunk[]
): ProcessingContext {
  return {
    ...context,
    chunks: {
      ...context.chunks,
      chunks
    }
  };
}

/**
 * Type guard to check if context has preprocessing data
 */
export function hasPreprocessing(context: ProcessingContext): context is ProcessingContext & { preprocessing: PreprocessingData } {
  return context.preprocessing !== undefined;
}

/**
 * Type guard to check if context has nodes (multi-chunk path)
 */
export function hasNodes(context: ProcessingContext): context is ProcessingContext & { nodes: FlatNode[] } {
  return context.nodes !== undefined && context.nodes.length > 0;
}

/**
 * Type guard to check if context can skip pipeline (single-chunk optimization)
 */
export function canSkipPipeline(context: ProcessingContext): boolean {
  return context.preprocessing?.canSkipPipeline === true;
}