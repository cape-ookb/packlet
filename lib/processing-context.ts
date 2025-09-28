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
  ProcessingMetrics,
  ProcessingPath,
  ErrorTracking,
  SourceData,
  StructureAnalysis
} from './processing-context-types';
import { initializeSource } from './content-metrics';
import { withDefaults } from './default-config';
import { startTimer, stopTimer } from './timer';

// Re-export types for convenience
export * from './processing-context-types';

/**
 * Initialize processing with source data, options defaults, and timing.
 * This creates the minimal initialized processing context.
 *
 * @param sourceDocument - The markdown content to process
 * @param fileTitle - The source file title/name
 * @param partialOptions - Chunking options (defaults will be applied)
 * @returns Object with source data, complete options, and overall timer
 */
export function initializeProcessing(
  sourceDocument: string,
  fileTitle: string,
  partialOptions: Partial<import('./types').ChunkOptions>
): { source: SourceData; options: import('./types').ChunkOptions; overallTimer: import('./timer').Timer } {
  const overallTimer = startTimer();
  const options = withDefaults(partialOptions as import('./types').ChunkOptions);
  const source = initializeSource(sourceDocument, fileTitle, options);

  return { source, options, overallTimer };
}

/**
 * Create initial processing context from input parameters.
 * This is a convenience wrapper around initializeProcessing for full context creation.
 */
export function createProcessingContext(
  sourceDocument: string,
  fileTitle: string,
  options: import('./types').ChunkOptions
): ProcessingContext {
  const { source, overallTimer } = initializeProcessing(sourceDocument, fileTitle, options);

  return {
    source,
    options,
    stage: 'initialized',
    path: 'undetermined',
    chunks: [],
    metrics: {},
    timing: {
      overall: overallTimer,
      stageMetrics: {
        initialized: startTimer()
      }
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
  // Complete timing for current stage
  const currentStageTimer = context.timing.stageMetrics[context.stage];
  const completedStageTimer = currentStageTimer ? stopTimer(currentStageTimer) : undefined;

  // Start timing for new stage
  const updatedStageMetrics = {
    ...context.timing.stageMetrics,
    ...(completedStageTimer && { [context.stage]: completedStageTimer }),
    [nextStage]: startTimer()
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
  // Complete final stage timing
  const finalContext = transitionStage(context, 'completed');

  // Stop the overall timer
  const completedOverallTimer = stopTimer(finalContext.timing.overall);

  return {
    ...finalContext,
    timing: {
      ...finalContext.timing,
      overall: completedOverallTimer
    },
    metrics: {
      ...finalContext.metrics,
      chunks: {
        ...finalContext.metrics.chunks,
        count: finalContext.chunks.length
      }
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
 * Update metrics in context
 */
export function updateMetrics(
  context: ProcessingContext,
  updates: Partial<ProcessingMetrics>
): ProcessingContext {
  return {
    ...context,
    metrics: {
      ...context.metrics,
      ...updates
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

/**
 * Update structure analysis in context
 */
export function updateStructure(
  context: ProcessingContext,
  structure: StructureAnalysis
): ProcessingContext {
  return {
    ...context,
    structure
  };
}

// === Type Guards ===


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
 * Check if processing is complete
 */
export function isComplete(context: ProcessingContext): boolean {
  return context.stage === 'completed';
}

/**
 * Get total processing duration
 */
export function getProcessingDuration(context: ProcessingContext): number | undefined {
  return context.timing.overall.durationMs;
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