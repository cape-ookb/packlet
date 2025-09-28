// index.ts
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
import { preprocess } from "./preprocess";
import { flow } from "./utils";
import { ChunkOptions, Chunk } from "./types";
import { FlatNode } from "./flatten-ast";
import { withDefaults } from "./default-config";

/**
 * Chunks a markdown document into semantically coherent pieces optimized for vector search.
 *
 * Uses a two-phase approach: preprocessing optimization for small documents (≤ maxTokens)
 * that skips expensive AST operations, and full pipeline processing for complex documents
 * requiring hierarchical splitting and intelligent packing.
 *
 * Both processing paths produce chunks with complete metadata including:
 * - Rich metadata (IDs, breadcrumbs, node types, source positions)
 * - embedText with conditional context prepending
 * - Token statistics and validation
 * - Performance metrics
 *
 * @param doc - The markdown content to chunk
 * @param fileTitle - The title/name of the source file (used for metadata and breadcrumbs)
 *                   Note: Calling code should handle frontmatter extraction and title normalization
 * @param opts - Chunking configuration options
 * @returns Object containing processed chunks and performance statistics
 */
/**
 * Process document as single chunk with full metadata pipeline
 */
function processSingleChunk(doc: string, options: ChunkOptions, fileTitle: string): Chunk[] {
	const preprocessResult = preprocess(doc, options, fileTitle);

	if (!preprocessResult.canSkipPipeline) {
		throw new Error('processSingleChunk called for document that requires multi-chunk processing');
	}

	// Apply same metadata processing as full pipeline
	let chunks = [preprocessResult.chunk!];
	chunks = normalizeChunks(chunks);
	chunks = attachMetadata(chunks, options, fileTitle);
	chunks = addEmbedText(chunks, options.breadcrumbMode, options.minTokens);
	chunks = assertOrFilterInvalid(chunks, options);

	return chunks;
}

/**
 * Process document through full multi-chunk pipeline
 */
function processMultiChunk(doc: string, options: ChunkOptions, fileTitle: string): Chunk[] {
	const pipeline = flow(
		parseMarkdown,
		flattenAst,
		(nodes: FlatNode[]) => splitOversized(nodes, options),
		(nodes: FlatNode[]) => packNodes(nodes, options),
		(chunks: Chunk[]) => addOverlap(chunks, options),
		normalizeChunks,
		(chunks: Chunk[]) => attachMetadata(chunks, options, fileTitle),
		(chunks: Chunk[]) => addEmbedText(chunks, options.breadcrumbMode, options.minTokens),
		(chunks: Chunk[]) => assertOrFilterInvalid(chunks, options),
	);

	return pipeline(doc);
}

export function chunkMarkdown(doc: string, fileTitle: string, opts: ChunkOptions): { chunks: Chunk[]; stats: any } {
	const startTime = performance.now();
	const options = withDefaults(opts);

	// Determine processing path
	const preprocessResult = preprocess(doc, options, fileTitle);
	const chunks = preprocessResult.canSkipPipeline
		? processSingleChunk(doc, options, fileTitle)
		: processMultiChunk(doc, options, fileTitle);

	const endTime = performance.now();
	const stats = computeStats(chunks, options, startTime, endTime);

	return { chunks, stats };
}
