/**
 * processing-context-types.ts
 *
 * Type definitions for the unified processing context system.
 * These types define the structure of data that flows through the chunking pipeline.
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