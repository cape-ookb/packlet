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
import { countTokens } from './tokenizer';

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

function updateTokenCount(chunk: Chunk): Chunk {
  const content = chunk.content || chunk.originalText || '';
  return {
    ...chunk,
    tokens: countTokens(content)
  };
}

function applyOverlapToChunk(
  chunk: Chunk,
  previousChunk: Chunk | null,
  overlapSentences: number
): Chunk {
  if (!previousChunk || overlapSentences <= 0) {
    return chunk;
  }

  const previousContent = previousChunk.content || previousChunk.originalText || '';
  const overlap = getTrailingSentences(previousContent, overlapSentences);
  if (!overlap) {
    return chunk;
  }

  const currentContent = chunk.content || chunk.originalText || '';
  const newContent = `${overlap} ${currentContent}`;
  const updatedChunk = {
    ...chunk,
    content: newContent
  };

  return updateTokenCount(updatedChunk);
}

export function addOverlap(chunks: Chunk[], options: ChunkOptions): Chunk[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const result: Chunk[] = [chunks[0]]; // First chunk has no overlap

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i];
    const previousChunk = chunks[i - 1];
    const overlappedChunk = applyOverlapToChunk(chunk, previousChunk, options.overlapSentences);
    result.push(overlappedChunk);
  }

  return result;
}