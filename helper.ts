const withDefaults = (o: ChunkOptions): ChunkOptions => ({
	minTokens: 200,
	maxTokens: 800,
	overlapSentences: 2,
	strictMode: true,
	targetTokens: 600,
	...o,
});