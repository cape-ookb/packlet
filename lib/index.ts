/**
 * index.ts
 *
 * Main entry point for the chunking library.
 * Provides the public API for chunking markdown documents.
 */

import { ChunkOptions, Chunk } from "./types";
import { ProcessingContext } from "./processing-context";
import { initializeProcessing } from "./initialize";
import {
	parseMarkdownStep,
	flattenAstStep,
	splitOversizedStep,
	packNodesStep,
	addOverlapStep,
	normalizeChunksStep,
	attachMetadataStep,
	addEmbedTextStep,
	validateChunksStep,
	finalizeWithStatsStep
} from "./pipeline";
import { flow } from "./utils";

/**
 * Complete chunking pipeline using functional composition.
 *
 * Chunks a markdown document into semantically coherent pieces optimized for vector search.
 * Uses a unified pipeline with ProcessingContext that flows through all stages.
 *
 * All documents receive full processing including:
 * - AST parsing and analysis
 * - Rich metadata (IDs, breadcrumbs, node types, source positions)
 * - embedText with conditional context prepending
 * - Token statistics and validation
 * - Performance metrics
 *
 * Each step is composable and can be used individually for custom pipelines.
 *
 * @param doc - The markdown content to chunk
 * @param fileTitle - The title/name of the source file (used for metadata and breadcrumbs)
 * @param opts - Chunking configuration options
 * @returns Complete processing context including chunks, stats, timing, and all metadata
 */
const runFullPipeline = flow(
	initializeProcessing,
	parseMarkdownStep,
	flattenAstStep,
	splitOversizedStep,
	packNodesStep,
	addOverlapStep,
	normalizeChunksStep,
	attachMetadataStep,
	addEmbedTextStep,
	validateChunksStep,
	finalizeWithStatsStep
);

export default runFullPipeline;

// Named export for backward compatibility
export { runFullPipeline as chunkMarkdown };

// Re-export types for library consumers
export type { Chunk, ChunkOptions } from "./types";
export type { ProcessingContext } from "./processing-context";

// Re-export pipeline components for custom pipeline composition
export { initializeProcessing } from "./initialize";
export {
	parseMarkdownStep,
	flattenAstStep,
	splitOversizedStep,
	packNodesStep,
	addOverlapStep,
	normalizeChunksStep,
	attachMetadataStep,
	addEmbedTextStep,
	validateChunksStep,
	finalizeWithStatsStep
} from "./pipeline";
export { flow } from "./utils";