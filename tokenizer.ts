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

// Token counting functionality
export function countTokens(text: string): number {
  // TODO: Use tiktoken or fast heuristic for token counting
  return Math.max(1, Math.floor(text.length / 3.8));
}