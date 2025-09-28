/**
 * processing-context-types.ts
 *
 * Type definitions for the unified processing context system.
 * These types define the structure of data that flows through the chunking pipeline.
 */

import { Chunk, ChunkOptions } from './types';
import { FlatNode } from './flatten-ast';
import type { ContentAnalysis } from './content-analysis/types';
import type { Timer } from './timer';

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
 * Minimal processing context for initialization
 */
export type ProcessingBase = {
  /** Source document and metadata */
  readonly source: SourceData;
  /** Chunking configuration with defaults applied */
  readonly options: ChunkOptions;
  /** Overall processing timer */
  timer: Timer;
  /** Current stage in the processing pipeline */
  stage: ProcessingStage;
};

/**
 * Source document information (immutable)
 */
export type SourceData = {
  /** Original markdown document content */
  content: string;
  /** Source file title/name for metadata and breadcrumbs */
  title: string;
  /** Total document length in characters */
  length: number;
  /** Total tokens in source document */
  tokens: number;
  /** Estimated number of chunks this document will produce */
  estimatedChunks: number;
};

/**
 * Document structure analysis (computed during processing)
 */
export type StructureAnalysis = {
  // Basic element counts
  headingCount: number;
  paragraphCount: number;
  codeBlockCount: number;
  listCount: number;
  tableCount: number;

  // Detailed heading analysis
  headingLevels: Record<number, number>; // Count by heading level (1-6)

  // Document characteristics
  maxNestingDepth: number;
  avgParagraphLength?: number;

  // Content type detection
  hasTableOfContents: boolean;
  hasFrontmatter: boolean;

  // Link and media counts
  linkCount: number;
  imageCount: number;

  // Additional markdown elements
  blockquoteCount: number;
  horizontalRuleCount: number;
};

/**
 * Processing metrics collected during chunking
 */
export type ProcessingMetrics = {
  /** Chunk metrics */
  chunks?: {
    /** Final chunk count */
    count: number;
    /** Token distribution */
    tokenDistribution?: {
      min: number;
      max: number;
      avg: number;
      median: number;
    };
    /** Quality assessment */
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
export type ProcessingContext = ProcessingBase & {
  // === Core Data ===
  /** Processed chunks (main output) */
  chunks?: Chunk[];

  /** Processing metrics collected during chunking */
  metrics?: ProcessingMetrics;

  // === Analysis Results ===
  /** Document structure analysis (computed during processing) */
  structure?: StructureAnalysis;

  /** Content analysis (from content-analysis system) */
  contentAnalysis?: ContentAnalysis;

  // === Intermediate Pipeline Data ===
  /** Parsed markdown AST */
  ast?: import('./types').AstRoot;

  /** Flattened AST nodes */
  nodes?: FlatNode[];

  // === Error Handling ===
  /** Error tracking and recovery */
  errors?: ErrorTracking;

  // === Final Results ===
  /** Final statistics (populated after processing completes) */
  stats?: any; // TODO: Type this properly with ChunkStats from stats.ts
};