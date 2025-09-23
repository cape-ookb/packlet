import { ChunkOptions } from './types';

export const withDefaults = (o: ChunkOptions): ChunkOptions => ({
	...o,
	minTokens: o.minTokens ?? 200,
	maxTokens: o.maxTokens ?? 800,
	overlapSentences: o.overlapSentences ?? 2,
	strictMode: o.strictMode ?? true,
	targetTokens: o.targetTokens ?? 600,
});