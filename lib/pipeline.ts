/**
 * pipeline.ts
 *
 * Main chunking pipeline implementation.
 * Orchestrates all processing steps and manages data flow through ProcessingContext.
 */

import { parseMarkdown } from "./parse-markdown";
import { flattenAst } from "./flatten-ast";
import { splitOversized } from "./split-node";
import { packNodes } from "./packer";
import { addOverlap } from "./overlap";
import { normalizeChunks } from "./normalize";
import { attachMetadata } from "./metadata";
import { addEmbedText } from "./embed-text";
import { assertOrFilterInvalid } from "./guardrails";
import { computeStats } from "./stats";
import { flow } from "./utils";
import { ProcessingContext, ProcessingBase } from "./processing-context";
import { initializeProcessing } from "./initialize";
import { stopTimer } from "./timer";

/**
 * Pipeline orchestrator functions
 * These adapt existing functions to work with ProcessingContext,
 * making data flow explicit and maintaining clean function signatures.
 */

// Parse markdown to AST
export function parseMarkdownStep(context: ProcessingContext): ProcessingContext {
	return {
		...context,
		ast: parseMarkdown(context.source.content)
	};
}

// Flatten AST to nodes
export function flattenAstStep(context: ProcessingContext): ProcessingContext {
	if (!context.ast) {
		throw new Error('AST not available for flattening');
	}
	return {
		...context,
		nodes: flattenAst(context.ast)
	};
}

// Split oversized nodes
export function splitOversizedStep(context: ProcessingContext): ProcessingContext {
	if (!context.nodes) {
		throw new Error('Nodes not available for splitting');
	}
	return {
		...context,
		nodes: splitOversized(context.nodes, context.options)
	};
}

// Pack nodes into chunks
export function packNodesStep(context: ProcessingContext): ProcessingContext {
	if (!context.nodes) {
		throw new Error('Nodes not available for packing');
	}
	return {
		...context,
		chunks: packNodes(context.nodes, context.options)
	};
}

// Add overlap between chunks
export function addOverlapStep(context: ProcessingContext): ProcessingContext {
	if (!context.chunks) {
		throw new Error('Chunks not available for adding overlap');
	}
	return {
		...context,
		chunks: addOverlap(context.chunks, context.options)
	};
}

// Normalize chunk text
export function normalizeChunksStep(context: ProcessingContext): ProcessingContext {
	if (!context.chunks) {
		throw new Error('Chunks not available for normalization');
	}
	return {
		...context,
		chunks: normalizeChunks(context.chunks)
	};
}

// Attach metadata to chunks
export function attachMetadataStep(context: ProcessingContext): ProcessingContext {
	if (!context.chunks) {
		throw new Error('Chunks not available for metadata attachment');
	}
	return {
		...context,
		chunks: attachMetadata(context.chunks, context.options, context.source.title)
	};
}

// Add embed text for vector search
export function addEmbedTextStep(context: ProcessingContext): ProcessingContext {
	if (!context.chunks) {
		throw new Error('Chunks not available for embed text');
	}
	return {
		...context,
		chunks: addEmbedText(
			context.chunks,
			context.options.breadcrumbMode,
			context.options.minTokens
		)
	};
}

// Validate chunks
export function validateChunksStep(context: ProcessingContext): ProcessingContext {
	if (!context.chunks) {
		throw new Error('Chunks not available for validation');
	}
	return {
		...context,
		chunks: assertOrFilterInvalid(context.chunks, context.options)
	};
}

// Compute statistics
export function computeStatsStep(context: ProcessingContext): ProcessingContext {
	// Get current elapsed time without stopping the timer
	const elapsedTime = performance.now() - context.timer.startTime;

	// Compute statistics using the elapsed time
	const stats = computeStats(
		context.chunks || [],
		context.options,
		context.timer.startTime,
		context.timer.startTime + elapsedTime
	);

	// Update context with stats and chunk metrics
	return {
		...context,
		metrics: {
			...context.metrics,
			chunks: {
				...(context.metrics?.chunks || {}),
				count: context.chunks?.length || 0
			}
		},
		stats
	} as ProcessingContext & { stats: any };
}

// Stop the timer and finalize processing
export function stopTimerStep(context: ProcessingContext): ProcessingContext {
	return {
		...context,
		timer: stopTimer(context.timer)
	};
}

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
 * Pipeline stages:
 * 1. Initialize processing context
 * 2. Parse markdown to AST
 * 3. Flatten AST to linear nodes
 * 4. Split oversized nodes
 * 5. Pack nodes into chunks
 * 6. Add overlap between chunks
 * 7. Normalize text
 * 8. Attach metadata
 * 9. Add embed text
 * 10. Validate chunks
 * 11. Compute statistics
 * 12. Stop timer and finalize
 *
 * Each step is composable and can be used individually for custom pipelines.
 *
 * @param doc - The markdown content to chunk
 * @param fileTitle - The title/name of the source file (used for metadata and breadcrumbs)
 * @param opts - Chunking configuration options
 * @returns Complete processing context including chunks, stats, timing, and all metadata
 */
export const runFullPipeline = flow(
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
	computeStatsStep,
	stopTimerStep
);