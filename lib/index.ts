/**
 * index.ts
 *
 * Main entry point for the chunking library.
 * Provides the public API for chunking markdown documents.
 */

import { runFullPipeline } from "./pipeline";

// Default export
export default runFullPipeline;

// Named export for backward compatibility
export { runFullPipeline as chunkMarkdown };

// Re-export types for library consumers
export type { Chunk, ChunkOptions } from "./types";
export type { ProcessingContext } from "./processing-context";

// Re-export pipeline components for custom pipeline composition
export { initializeProcessing } from "./initialize";
export {
	runFullPipeline as runPipelineSteps,
	parseMarkdownStep,
	flattenAstStep,
	splitOversizedStep,
	packNodesStep,
	addOverlapStep,
	normalizeChunksStep,
	attachMetadataStep,
	addEmbedTextStep,
	validateChunksStep,
	computeStatsStep,
	stopTimerStep
} from "./pipeline";
export { flow } from "./utils";