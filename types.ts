// types.ts (essentials only)
export type ChunkOptions = {
	minTokens: number;  // e.g., 200
	maxTokens: number;  // e.g., 800
	overlapSentences: number; // e.g., 1..3
	strictMode?: boolean;
	targetTokens?: number; // for estimates
};
