// index.ts
import { parseMarkdown } from "./parse-markdown";
import { flattenAst } from "./flatten-ast";
import { splitOversized } from "./split-node";
import { packNodes } from "./packer";
import { addOverlap } from "./overlap";
import { normalizeChunks } from "./normalize";
import { attachMetadata } from "./metadata";
import { assertOrFilterInvalid } from "./guardrails";
import { computeStats } from "./stats";
import { countTokens } from "./tokenizer";
import { flow } from "./utils";
import type { ChunkOptions, Chunk[] } from "./types";

export function chunkMarkdown(doc: string, opts: ChunkOptions): { chunks: Chunk[]; stats: any } {
	const options = withDefaults(opts);
	const pipeline = flow(
		parseMarkdown,
		flattenAst,
		(nodes) => splitOversized(nodes, options, countTokens),
		(nodes) => packNodes(nodes, options, countTokens),
		(chunks) => addOverlap(chunks, options),
		normalizeChunks,
		(chunks) => attachMetadata(chunks, options, countTokens),
		(chunks) => assertOrFilterInvalid(chunks, options),
	);

	const chunks = pipeline(doc);
	const stats = computeStats(chunks, options, countTokens);
	return { chunks, stats };
}
