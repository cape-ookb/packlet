/**
 * overlap.ts
 *
 * Adds trailing sentences from previous chunk.
 *
 * Configurable overlap size (typically 1-3 sentences).
 *
 * Overlap strategy:
 * - Extract last N sentences from previous chunk
 * - Prepend to current chunk text
 * - Update token count to reflect added text
 *
 * Benefits of sentence-based overlap:
 * - Preserves complete thoughts (vs token-based cutting)
 * - Headers naturally stay with their content
 * - Maintains semantic continuity for retrieval
 *
 * Implementation considerations:
 * - Use regex to detect sentence boundaries
 * - Handle edge cases (code blocks, lists, etc.)
 * - Skip overlap for first chunk
 * - Adjust token counts after adding overlap
 */

import { Chunk, ChunkOptions } from './types';

function extractSentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  return sentences.length > 0 ? sentences : [text];
}

function getTrailingSentences(text: string, count: number): string {
  if (count <= 0) return '';

  const sentences = extractSentences(text);
  const trailingSentences = sentences.slice(-count);
  return trailingSentences.join(' ');
}

function updateTokenCount(chunk: Chunk, countTokens: Function): Chunk {
  return {
    ...chunk,
    tokens: countTokens(chunk.content)
  };
}

function applyOverlapToChunk(
  chunk: Chunk,
  previousChunk: Chunk | null,
  overlapSentences: number,
  countTokens: Function
): Chunk {
  if (!previousChunk || overlapSentences <= 0) {
    return chunk;
  }

  const overlap = getTrailingSentences(previousChunk.content, overlapSentences);
  if (!overlap) {
    return chunk;
  }

  const newContent = `${overlap} ${chunk.content}`;
  const updatedChunk = {
    ...chunk,
    content: newContent
  };

  return updateTokenCount(updatedChunk, countTokens);
}

export function addOverlap(chunks: Chunk[], options: ChunkOptions, countTokens: Function): Chunk[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const result: Chunk[] = [chunks[0]]; // First chunk has no overlap

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const previousChunk = chunks[i - 1];
    const overlappedChunk = applyOverlapToChunk(chunk, previousChunk, options.overlapSentences, countTokens);
    result.push(overlappedChunk);
  }

  return result;
}