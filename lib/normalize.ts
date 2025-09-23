/**
 * normalize.ts
 *
 * Cleans up whitespace and formatting while preserving structure.
 *
 * - Dedents code blocks
 * - Collapses blank lines
 * - Preserves fenced code blocks intact
 *
 * Normalization rules:
 * - Trim leading/trailing whitespace
 * - Collapse multiple blank lines to single blank line
 * - Preserve intentional formatting in code blocks
 * - Standardize line endings (\n)
 * - Remove trailing spaces from lines
 *
 * Special handling for code:
 * - Detect minimum indentation level
 * - Remove common indentation while preserving relative indents
 * - Keep fenced code blocks exactly as authored
 * - Preserve inline code formatting
 */

import { Chunk } from './types';

function removeTrailingSpaces(text: string): string {
  return text.split('\n').map(line => line.replace(/\s+$/, '')).join('\n');
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n\s*\n\s*\n+/g, '\n\n');
}


function normalizeInternalSpaces(text: string): string {
  const lines = text.split('\n');
  let inFencedBlock = false;

  return lines.map(line => {
    if (line.trim().startsWith('```')) {
      inFencedBlock = !inFencedBlock;
      return line;
    }

    if (inFencedBlock || line.trim() === '') {
      return line;
    }

    return line.replace(/\s+/g, ' ');
  }).join('\n');
}

function getMinIndentation(lines: string[]): number {
  const nonEmptyLines = lines.filter(line => line.trim().length > 0);
  if (nonEmptyLines.length === 0) return 0;

  return Math.min(...nonEmptyLines.map(line => {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }));
}

function dedentCode(text: string): string {
  const lines = text.split('\n');
  let inFencedBlock = false;

  // Find lines that are not in fenced blocks for calculating min indent
  const dedentableLines: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inFencedBlock = !inFencedBlock;
    } else if (!inFencedBlock && line.trim().length > 0) {
      dedentableLines.push(line);
    }
  }

  const minIndent = getMinIndentation(dedentableLines);
  if (minIndent === 0) return text;

  // Reset for actual processing
  inFencedBlock = false;

  return lines.map(line => {
    if (line.trim().startsWith('```')) {
      inFencedBlock = !inFencedBlock;
      return line;
    }

    if (inFencedBlock || line.trim() === '') {
      return line;
    }

    // Dedent by removing min indentation
    const actualIndent = line.length - line.trimStart().length;
    const indentToRemove = Math.min(minIndent, actualIndent);
    return line.substring(indentToRemove);
  }).join('\n');
}

function normalizeText(text: string): string {
  let normalized = text;
  normalized = removeTrailingSpaces(normalized);
  normalized = collapseBlankLines(normalized);
  normalized = normalizeInternalSpaces(normalized);
  normalized = dedentCode(normalized);
  normalized = normalized.trim();
  return normalized;
}

export function normalizeChunks(chunks: Chunk[]): Chunk[] {
  return chunks.map(chunk => ({
    ...chunk,
    content: chunk.content ? normalizeText(chunk.content) : ''
  }));
}