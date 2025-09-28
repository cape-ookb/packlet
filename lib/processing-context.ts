/**
 * processing-context.ts
 *
 * Utility functions for managing the ProcessingContext throughout the pipeline.
 * Provides helper functions to create, update, and query the context.
 */

import type { Chunk } from './types';
import type { FlatNode } from './flatten-ast';
import type {
  ProcessingContext,
  ProcessingStage,
  ContentMetrics,
  PreprocessingData,
  ProcessingPath,
  ErrorTracking
} from './processing-context-types';
import { calculateSourceMetrics } from './content-metrics';

// Re-export types for convenience
export * from './processing-context-types';

/**
 * Create initial processing context from input parameters
 */
export function createProcessingContext(
  sourceDocument: string,
  fileTitle: string,
  options: import('./types').ChunkOptions
): ProcessingContext {
  const startTime = performance.now();

  // Calculate source metrics upfront
  const sourceMetrics = calculateSourceMetrics(sourceDocument);

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
    content: sourceMetrics,
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
 * Update AST nodes in context
 */
export function updateNodes(
  context: ProcessingContext,
  nodes: FlatNode[]
): ProcessingContext {
  return {
    ...context,
    nodes
  };
}

/**
 * Set processing path
 */
export function setProcessingPath(
  context: ProcessingContext,
  path: ProcessingPath
): ProcessingContext {
  return {
    ...context,
    path
  };
}

// === Type Guards ===

/**
 * Type guard to check if context has preprocessing data
 */
export function hasPreprocessing(
  context: ProcessingContext
): context is ProcessingContext & { preprocessing: PreprocessingData } {
  return context.preprocessing !== undefined;
}

/**
 * Type guard to check if context has nodes (multi-chunk path)
 */
export function hasNodes(
  context: ProcessingContext
): context is ProcessingContext & { nodes: FlatNode[] } {
  return context.nodes !== undefined && context.nodes.length > 0;
}

/**
 * Type guard to check if context has errors
 */
export function hasErrors(
  context: ProcessingContext
): context is ProcessingContext & { errors: ErrorTracking } {
  return context.errors !== undefined && context.errors.errors.length > 0;
}

/**
 * Type guard to check if context can skip pipeline (single-chunk optimization)
 */
export function canSkipPipeline(context: ProcessingContext): boolean {
  return context.preprocessing?.canSkipPipeline === true;
}

/**
 * Check if processing is complete
 */
export function isComplete(context: ProcessingContext): boolean {
  return context.stage === 'completed';
}

/**
 * Get total processing duration
 */
export function getProcessingDuration(context: ProcessingContext): number | undefined {
  return context.timing.totalDurationMs;
}

/**
 * Get stage duration
 */
export function getStageDuration(
  context: ProcessingContext,
  stage: ProcessingStage
): number | undefined {
  return context.timing.stageMetrics[stage]?.durationMs;
}