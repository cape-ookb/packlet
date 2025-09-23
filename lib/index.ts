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
import { flow } from "./utils";
import { ChunkOptions, Chunk } from "./types";
import { FlatNode } from "./flatten-ast";
import { withDefaults } from "./default-config";

export function chunkMarkdown(doc: string, fileTitle: string, opts: ChunkOptions): { chunks: Chunk[]; stats: any } {
	const startTime = performance.now();
	const options = withDefaults(opts);

	const pipeline = flow(
		parseMarkdown,
		flattenAst,
		(nodes: FlatNode[]) => splitOversized(nodes, options),
		(nodes: FlatNode[]) => packNodes(nodes, options),
		(chunks: Chunk[]) => addOverlap(chunks, options),
		normalizeChunks,
		(chunks: Chunk[]) => attachMetadata(chunks, options, fileTitle),
		(chunks: Chunk[]) => assertOrFilterInvalid(chunks, options),
	);

	const chunks = pipeline(doc);
	const endTime = performance.now();

	const stats = computeStats(chunks, options, startTime, endTime);

	return { chunks, stats };
}
