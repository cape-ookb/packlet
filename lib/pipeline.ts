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
import { ProcessingContext } from "./processing-context";

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
	return {
		...context,
		chunks: addOverlap(context.chunks, context.options)
	};
}

// Normalize chunk text
export function normalizeChunksStep(context: ProcessingContext): ProcessingContext {
	return {
		...context,
		chunks: normalizeChunks(context.chunks)
	};
}

// Attach metadata to chunks
export function attachMetadataStep(context: ProcessingContext): ProcessingContext {
	return {
		...context,
		chunks: attachMetadata(context.chunks, context.options, context.source.title)
	};
}

// Add embed text for vector search
export function addEmbedTextStep(context: ProcessingContext): ProcessingContext {
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
	return {
		...context,
		chunks: assertOrFilterInvalid(context.chunks, context.options)
	};
}

// Finalize processing and compute statistics
export function finalizeWithStatsStep(context: ProcessingContext): ProcessingContext {
	const endTime = performance.now();

	// Compute final statistics
	const stats = computeStats(
		context.chunks,
		context.options,
		context.timer.startTime,
		endTime
	);

	// Update context with final timing, chunk metrics, and stats
	return {
		...context,
		metrics: {
			...context.metrics,
			chunks: {
				...(context.metrics?.chunks || {}),
				count: context.chunks?.length || 0,
				// Additional chunk metrics could be added here
			}
		},
		stats
	} as ProcessingContext & { stats: any };
}

/**
 * Main processing pipeline that transforms markdown into chunks.
 *
 * Pipeline stages:
 * 1. Parse markdown to AST
 * 2. Flatten AST to linear nodes
 * 3. Split oversized nodes
 * 4. Pack nodes into chunks
 * 5. Add overlap between chunks
 * 6. Normalize text
 * 7. Attach metadata
 * 8. Add embed text
 * 9. Validate chunks
 * 10. Compute statistics and finalize
 *
 * @param context - Initial processing context with source document
 * @returns Final context with processed chunks, stats, and all metadata
 */
export function runFullPipeline(context: ProcessingContext): ProcessingContext & { stats: any } {
	const pipeline = flow(
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

	return pipeline(context);
}