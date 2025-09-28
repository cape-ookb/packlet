/**
 * markdown-utils.ts
 *
 * Utilities for processing and analyzing markdown content.
 * These functions help extract information from markdown text
 * without needing full AST parsing.
 */

import { Chunk } from './types';

/**
 * Extract the first heading from content if it exists.
 */
export function extractHeading(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Clean markdown formatting from a heading string.
 * Removes #, links, inline code, bold, italic, strikethrough.
 */
export function cleanMarkdownFromHeading(heading: string): string {
  return heading
    // Remove # symbols
    .replace(/^#+\s*/, '')
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove inline code `text` -> text
    .replace(/`([^`]+)`/g, '$1')
    // Remove bold **text** -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove italic *text* -> text
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove strikethrough ~~text~~ -> text
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

/**
 * Extract node types from chunk content by analyzing markdown patterns.
 * Returns an array of detected node types.
 */
export function extractNodeTypes(chunk: Chunk): string[] {
  const existingTypes = chunk.metadata?.types || chunk.metadata?.nodeTypes || [];
  if (Array.isArray(existingTypes) && existingTypes.length > 0) {
    return existingTypes;
  }

  const nodeTypes = new Set<string>();
  const content = chunk.originalText || chunk.content || '';

  if (content.includes('#')) nodeTypes.add('heading');
  if (content.includes('```')) nodeTypes.add('code');
  if (content.includes('- ') || content.includes('* ') || /^\d+\./m.test(content)) nodeTypes.add('list-item');
  if (content.includes('|')) nodeTypes.add('table');
  if (content.includes('>')) nodeTypes.add('blockquote');
  nodeTypes.add('paragraph'); // Most chunks contain paragraph content

  return Array.from(nodeTypes);
}