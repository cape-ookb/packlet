/**
 * stats.ts
 *
 * Calculates chunk stats (min/avg/max tokens, expected vs actual count).
 *
 * Emits summary for monitoring/debug.
 *
 * Statistics computed:
 * - Total chunks created
 * - Token distribution (min, avg, median, max)
 * - Expected vs actual chunk count
 * - Processing time
 * - Quality metrics (chunks filtered, etc.)
 *
 * Comparison metrics:
 * - Expected chunks = ceil(totalTokens / targetTokens)
 * - Deviation = abs(actual - expected) / expected
 * - Flag if deviation > tolerance (e.g., 20%)
 *
 * Output format:
 * - Summary object with all metrics
 * - Console log in development
 * - Metrics emission for monitoring in production
 *
 * Used for:
 * - Performance tuning
 * - Quality monitoring
 * - Debugging chunking issues
 */

import { Chunk, ChunkOptions } from './types';

export type ChunkStats = {
  // Basic counts
  totalChunks: number;
  totalTokens: number;

  // Token distribution
  minTokens: number;
  maxTokens: number;
  avgTokens: number;
  medianTokens: number;

  // Expected vs actual analysis
  expectedChunks: number;
  actualChunks: number;
  efficiencyRatio: number; // actual/expected (closer to 1.0 is better)
  deviation: number; // percentage deviation from expected

  // Distribution analysis
  tokenDistribution: {
    underTarget: number;
    atTarget: number;
    overTarget: number;
  };

  // Quality metrics
  sourceLength: number;
  compressionRatio: number; // totalTokens/sourceLength
  qualityFlag: boolean; // true if deviation > 20%

  // Performance metrics (added by pipeline)
  processingTimeMs?: number;
  processingTime?: string;
};

function calculateExpectedChunks(sourceLength: number, options: ChunkOptions): number {
  const targetTokens = options.targetTokens || Math.floor((options.minTokens + options.maxTokens) / 2);
  const estimatedTokens = Math.ceil(sourceLength / 3.8); // Rough char-to-token heuristic
  return Math.ceil(estimatedTokens / targetTokens);
}

function calculateMedian(tokens: number[]): number {
  const sorted = [...tokens].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function analyzeTokenDistribution(chunks: Chunk[], options: ChunkOptions) {
  const targetTokens = options.targetTokens || Math.floor((options.minTokens + options.maxTokens) / 2);
  const tolerance = Math.floor(targetTokens * 0.1); // 10% tolerance

  let underTarget = 0;
  let atTarget = 0;
  let overTarget = 0;

  for (const chunk of chunks) {
    if (chunk.tokens < targetTokens - tolerance) {
      underTarget++;
    } else if (chunk.tokens > targetTokens + tolerance) {
      overTarget++;
    } else {
      atTarget++;
    }
  }

  return { underTarget, atTarget, overTarget };
}

export function computeStats(chunks: Chunk[], options: ChunkOptions, _countTokens: Function): ChunkStats {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      totalTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      avgTokens: 0,
      medianTokens: 0,
      expectedChunks: 0,
      actualChunks: 0,
      efficiencyRatio: 0,
      deviation: 0,
      tokenDistribution: { underTarget: 0, atTarget: 0, overTarget: 0 },
      sourceLength: 0,
      compressionRatio: 0,
      qualityFlag: false
    };
  }

  const tokenCounts = chunks.map(chunk => chunk.tokens);
  const totalTokens = tokenCounts.reduce((sum, tokens) => sum + tokens, 0);
  const sourceLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);

  const expectedChunks = calculateExpectedChunks(sourceLength, options);
  const actualChunks = chunks.length;
  const efficiencyRatio = expectedChunks > 0 ? actualChunks / expectedChunks : 0;
  const deviation = expectedChunks > 0 ? Math.abs(actualChunks - expectedChunks) / expectedChunks : 0;

  return {
    totalChunks: chunks.length,
    totalTokens,
    minTokens: Math.min(...tokenCounts),
    maxTokens: Math.max(...tokenCounts),
    avgTokens: Math.round(totalTokens / chunks.length),
    medianTokens: Math.round(calculateMedian(tokenCounts)),
    expectedChunks,
    actualChunks,
    efficiencyRatio: Math.round(efficiencyRatio * 100) / 100,
    deviation: Math.round(deviation * 100) / 100,
    tokenDistribution: analyzeTokenDistribution(chunks, options),
    sourceLength,
    compressionRatio: Math.round((totalTokens / sourceLength) * 100) / 100,
    qualityFlag: deviation > 0.2 // Flag if deviation > 20%
  };
}