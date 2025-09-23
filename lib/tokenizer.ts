/**
 * tokenizer.ts
 *
 * Wraps `js-tiktoken` for accurate token counting.
 *
 * Exports `countTokens(text: string): number`.
 * Has fallback heuristic if tokenizer unavailable.
 *
 * Token counting strategies:
 * - Primary: Use tiktoken with model-specific encoding (e.g., cl100k_base for GPT-4)
 * - Fallback: ~3.8 characters per token for English text
 *
 * Performance considerations:
 * - Cache encoder instance for reuse
 * - Consider using heuristic for speed during development
 * - Exact counting important for production to avoid exceeding limits
 */

import { getEncoding } from 'js-tiktoken';

let encoder: ReturnType<typeof getEncoding> | null = null;

function getEncoder() {
  if (!encoder) {
    try {
      encoder = getEncoding('cl100k_base'); // GPT-4 encoding
    } catch (error) {
      console.warn('Failed to initialize tiktoken encoder:', error);
      encoder = null;
    }
  }
  return encoder;
}

export function countTokens(text: string): number {
  const enc = getEncoder();

  if (enc) {
    try {
      return enc.encode(text).length;
    } catch (error) {
      console.warn('Failed to encode text with tiktoken, falling back to heuristic:', error);
    }
  }

  // Fallback heuristic: ~3.8 characters per token for English text
  return text.length === 0 ? 0 : Math.max(1, Math.floor(text.length / 3.8));
}