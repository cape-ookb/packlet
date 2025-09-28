import { ChunkOptions } from './types';

export const withDefaults = (o: ChunkOptions): ChunkOptions => ({
	...o,
	minTokens: o.minTokens ?? 64,
	maxTokens: o.maxTokens ?? 512,
	overlapSentences: o.overlapSentences ?? 2,
	strictMode: o.strictMode ?? true,
	targetTokens: o.targetTokens ?? 400, // 250–400 is usually fine.
	breadcrumbMode: o.breadcrumbMode ?? "conditional",
});