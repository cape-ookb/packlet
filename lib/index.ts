/**
 * index.ts
 *
 * Main entry point for the chunking library.
 * Provides the public API for chunking markdown documents.
 */

import { ChunkOptions, Chunk } from "./types";
import { withDefaults } from "./default-config";
import { createProcessingContext, ProcessingContext } from "./processing-context";
import { runFullPipeline } from "./pipeline";

/**
 * Result of the chunking process, containing all context and statistics.
 */
export interface ChunkingResult extends ProcessingContext {
	stats: any;
}

/**
 * Chunks a markdown document into semantically coherent pieces optimized for vector search.
 *
 * Uses a unified pipeline with ProcessingContext that flows through all stages.
 * Smart optimizations happen naturally within individual steps (e.g., splitting
 * and packing already handle simple cases efficiently).
 *
 * All documents receive full processing including:
 * - AST parsing and analysis
 * - Rich metadata (IDs, breadcrumbs, node types, source positions)
 * - embedText with conditional context prepending
 * - Token statistics and validation
 * - Performance metrics
 *
 * @param doc - The markdown content to chunk
 * @param fileTitle - The title/name of the source file (used for metadata and breadcrumbs)
 *                   Note: Calling code should handle frontmatter extraction and title normalization
 * @param opts - Chunking configuration options
 * @returns Complete processing context including chunks, stats, timing, and all metadata
 */
export function chunkMarkdown(
	doc: string,
	fileTitle: string,
	opts: ChunkOptions
): ChunkingResult {
	const options = withDefaults(opts);

	// Create initial context with source metrics already calculated
	const context = createProcessingContext(doc, fileTitle, options);

	// Run the full processing pipeline (includes stats calculation)
	return runFullPipeline(context);
}

// Re-export types for library consumers
export type { Chunk, ChunkOptions } from "./types";
export type { ProcessingContext } from "./processing-context";