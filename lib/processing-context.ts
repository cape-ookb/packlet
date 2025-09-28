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
  ProcessingBase,
  ProcessingStage,
  ProcessingMetrics,
  ProcessingPath,
  ErrorTracking,
  StructureAnalysis
} from './processing-context-types';
import { initializeSource } from './source';
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
): ProcessingBase {
  const timer = startTimer();
  const options = withDefaults(partialOptions as import('./types').ChunkOptions);
  const source = initializeSource(sourceDocument, fileTitle, options);

  return { source, options, timer };
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
  const base = initializeProcessing(sourceDocument, fileTitle, options);

  return {
    ...base,
    stage: 'initialized',
    path: 'undetermined',
    chunks: [],
    metrics: {}
  };
}

/**
 * Transition context to next processing stage
 */
export function transitionStage(
  context: ProcessingContext,
  nextStage: ProcessingStage
): ProcessingContext {
  return {
    ...context,
    stage: nextStage
  };
}

/**
 * Complete processing by recording final timing
 */
export function completeProcessing(context: ProcessingContext): ProcessingContext {
  // Complete final stage timing
  const finalContext = transitionStage(context, 'completed');

  // Stop the overall timer
  const completedTimer = stopTimer(finalContext.timer);

  return {
    ...finalContext,
    timer: completedTimer,
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
  return context.timer.durationMs;
}

/**
 * Get stage duration - placeholder for future stage-specific timing
 */
export function getStageDuration(
  _context: ProcessingContext,
  _stage: ProcessingStage
): number | undefined {
  // TODO: Implement stage-specific timing when needed
  return undefined;
}