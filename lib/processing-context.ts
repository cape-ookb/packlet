/**
 * processing-context.ts
 *
 * Unified context object that flows through the entire chunking pipeline.
 * Eliminates parameter passing duplication and provides single source of truth
 * for all processing state, configuration, and intermediate results.
 */

import { Chunk, ChunkOptions } from './types';
import { FlatNode } from './flatten-ast';
import { PreprocessResult } from './preprocess';

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

  /** Performance timing */
  timing: {
    startTime: number;
    endTime?: number;
  };

  // === Preprocessing Results ===
  /** Results from preprocessing analysis */
  preprocessResult?: PreprocessResult;

  // === Intermediate Pipeline Data ===
  /** AST nodes (multi-chunk path only) */
  nodes?: FlatNode[];

  /** Current chunks being processed */
  chunks: Chunk[];

  // === Error Handling ===
  /** Processing errors encountered */
  errors?: Array<{
    stage: ProcessingStage;
    error: Error;
    recoverable: boolean;
  }>;

  // === Debug/Monitoring ===
  /** Performance metrics for each stage */
  stageMetrics?: Record<ProcessingStage, {
    startTime: number;
    endTime?: number;
    durationMs?: number;
  }>;
};

/**
 * Create initial processing context from input parameters
 */
export function createProcessingContext(
  sourceDocument: string,
  fileTitle: string,
  options: ChunkOptions
): ProcessingContext {
  return {
    sourceDocument,
    fileTitle,
    options,
    stage: 'initialized',
    path: 'undetermined',
    timing: {
      startTime: performance.now()
    },
    chunks: [],
    stageMetrics: {}
  };
}

/**
 * Transition context to next processing stage with optional timing
 */
export function transitionStage(
  context: ProcessingContext,
  nextStage: ProcessingStage,
  recordTiming: boolean = true
): ProcessingContext {
  const now = performance.now();

  // Record timing for previous stage if metrics are being tracked
  if (recordTiming && context.stageMetrics) {
    const currentStageMetric = context.stageMetrics[context.stage];
    if (currentStageMetric && !currentStageMetric.endTime) {
      currentStageMetric.endTime = now;
      currentStageMetric.durationMs = now - currentStageMetric.startTime;
    }

    // Start timing for new stage
    context.stageMetrics[nextStage] = {
      startTime: now
    };
  }

  return {
    ...context,
    stage: nextStage
  };
}

/**
 * Complete processing by recording final timing
 */
export function completeProcessing(context: ProcessingContext): ProcessingContext {
  const endTime = performance.now();

  // Complete final stage timing
  const finalContext = transitionStage(context, 'completed', true);

  return {
    ...finalContext,
    timing: {
      ...finalContext.timing,
      endTime
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
  const errors = context.errors || [];

  return {
    ...context,
    errors: [
      ...errors,
      {
        stage: context.stage,
        error,
        recoverable
      }
    ]
  };
}

/**
 * Type guard to check if context has preprocessing results
 */
export function hasPreprocessResult(context: ProcessingContext): context is ProcessingContext & { preprocessResult: PreprocessResult } {
  return context.preprocessResult !== undefined;
}

/**
 * Type guard to check if context has nodes (multi-chunk path)
 */
export function hasNodes(context: ProcessingContext): context is ProcessingContext & { nodes: FlatNode[] } {
  return context.nodes !== undefined && context.nodes.length > 0;
}