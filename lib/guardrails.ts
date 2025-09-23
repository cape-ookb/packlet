/**
 * guardrails.ts
 *
 * Validates chunk quality and reports issues.
 *
 * NOTE: We prevent low-quality chunks during creation (in packer), not through post-filtering.
 * This module is primarily for validation and monitoring, not filtering.
 *
 * Quality checks:
 * - Not just formatting (---, ```, ###)
 * - Not orphaned code without context
 * - Not empty headers
 * - Not exceeding max token limit
 * - Not whitespace-only or empty string
 * - Token count validation (with single-chunk exception)
 *
 * Modes:
 * - strictMode: Throw errors on violations (development/testing)
 * - lenientMode: Log warnings only (production)
 *
 * Single-chunk exception: Small chunks are allowed if the entire document
 * fits in one chunk (prevents penalizing small documents).
 *
 * Metadata:
 * - Each violation includes a reason code (e.g., "TOO_SHORT", "ORPHANED_CODE")
 * - Can be attached to logs or monitoring for analysis
 */

import { Chunk, ChunkOptions } from './types';

export type ValidationError = {
  code: string;
  message: string;
  chunk: Chunk;
};

function isEmptyOrWhitespace(content: string): boolean {
  return content.trim().length === 0;
}

function isTooShort(chunk: Chunk, minTokens: number, isSingleChunkDocument: boolean): boolean {
  const tokens = chunk.tokenStats?.tokens || chunk.tokens || 0;

  // Single-chunk documents are exempt from minTokens requirement
  if (isSingleChunkDocument) {
    return false;
  }

  return tokens < minTokens;
}

function exceedsMaxTokens(chunk: Chunk, maxTokens: number): boolean {
  return (chunk.tokenStats?.tokens || chunk.tokens || 0) > maxTokens;
}

function isFormattingOnly(content: string): boolean {
  const cleanContent = content.trim();

  // Check if content is just markdown formatting
  const formattingOnlyPatterns = [
    /^#{1,6}\s*$/, // Empty headers
    /^-{3,}$/, // Horizontal rules
    /^`{3,}$/, // Empty code blocks
    /^[*_\-\s]*$/, // Just emphasis characters and whitespace
    /^[|\s]*$/, // Just table separators
    /^[>\s]*$/ // Just blockquote markers
  ];

  return formattingOnlyPatterns.some(pattern => pattern.test(cleanContent));
}

function isEmptyHeader(content: string): boolean {
  const lines = content.split('\n');
  const firstLine = lines[0]?.trim() || '';

  // Check if it's just a header with no content after the #
  if (firstLine.match(/^#{1,6}\s*$/)) {
    return true;
  }

  // Check if it's a header with title but followed only by whitespace
  if (firstLine.match(/^#{1,6}\s+.+/) && lines.length > 1) {
    return lines.slice(1).every(line => line.trim() === '');
  }

  return false;
}

function isOrphanedCode(content: string, minProseChars: number = 200): boolean {
  const codeBlockPattern = /```[\s\S]*?```/g;
  const inlineCodePattern = /`[^`]+`/g;

  // Extract code blocks and calculate their size
  const codeBlocks = content.match(codeBlockPattern) || [];
  const inlineCode = content.match(inlineCodePattern) || [];

  if (codeBlocks.length === 0 && inlineCode.length === 0) {
    return false; // No code, can't be orphaned code
  }

  // Remove all code to see how much prose remains
  let proseContent = content.replace(codeBlockPattern, '').replace(inlineCodePattern, '');
  proseContent = proseContent.replace(/^\s*#{1,6}\s*.*$/gm, ''); // Remove headers
  proseContent = proseContent.replace(/^\s*[-*+]\s+/gm, ''); // Remove list markers
  proseContent = proseContent.replace(/^\s*>\s+/gm, ''); // Remove blockquote markers
  proseContent = proseContent.trim();

  return proseContent.length < minProseChars;
}

function validateChunk(chunk: Chunk, options: ChunkOptions, isSingleChunkDocument: boolean = false): ValidationError[] {
  const errors: ValidationError[] = [];
  const content = chunk.originalText || chunk.content || '';

  // Check for empty or whitespace-only content
  if (isEmptyOrWhitespace(content)) {
    errors.push({
      code: 'EMPTY_CONTENT',
      message: 'Chunk contains only whitespace or is empty',
      chunk
    });
  }

  // Check minimum token count
  if (isTooShort(chunk, options.minTokens, isSingleChunkDocument)) {
    errors.push({
      code: 'TOO_SHORT',
      message: `Chunk has ${chunk.tokenStats?.tokens || chunk.tokens || 0} tokens, below minimum of ${options.minTokens}`,
      chunk
    });
  }

  // Check maximum token count
  if (exceedsMaxTokens(chunk, options.maxTokens)) {
    errors.push({
      code: 'TOO_LONG',
      message: `Chunk has ${chunk.tokenStats?.tokens || chunk.tokens || 0} tokens, exceeds maximum of ${options.maxTokens}`,
      chunk
    });
  }

  // Check for formatting-only content
  if (isFormattingOnly(content)) {
    errors.push({
      code: 'FORMATTING_ONLY',
      message: 'Chunk contains only markdown formatting without meaningful content',
      chunk
    });
  }

  // Check for empty headers
  if (isEmptyHeader(content)) {
    errors.push({
      code: 'EMPTY_HEADER',
      message: 'Chunk contains header without any content',
      chunk
    });
  }

  // Check for orphaned code
  if (isOrphanedCode(content)) {
    errors.push({
      code: 'ORPHANED_CODE',
      message: 'Chunk contains code without sufficient context or explanation',
      chunk
    });
  }

  return errors;
}

function logValidationErrors(errors: ValidationError[]): void {
  errors.forEach(error => {
    console.warn(`[Guardrails] ${error.code}: ${error.message}`);
  });
}

export function validateChunks(chunks: Chunk[], options: ChunkOptions): Chunk[] {
  const strictMode = options.strictMode ?? false;
  const allErrors: ValidationError[] = [];
  const isSingleChunkDocument = chunks.length === 1;

  for (const chunk of chunks) {
    const errors = validateChunk(chunk, options, isSingleChunkDocument);

    if (errors.length > 0) {
      allErrors.push(...errors);

      if (strictMode) {
        // In strict mode, throw on first validation error
        const firstError = errors[0];
        throw new Error(`Chunk validation failed: ${firstError.code} - ${firstError.message}`);
      } else {
        // In lenient mode, just log warnings - no filtering
        logValidationErrors(errors);
      }
    }
  }

  if (!strictMode && allErrors.length > 0) {
    console.warn(`[Guardrails] Found ${allErrors.length} validation issues in ${chunks.length} total chunks`);
  }

  // Return all chunks - we no longer filter out "invalid" chunks
  return chunks;
}

// Keep the old function name for backward compatibility, but mark as deprecated
export function assertOrFilterInvalid(chunks: Chunk[], options: ChunkOptions): Chunk[] {
  return validateChunks(chunks, options);
}