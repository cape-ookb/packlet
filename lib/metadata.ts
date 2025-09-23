/**
 * metadata.ts
 *
 * Attaches heading trail, node type, token count, file path (if available).
 *
 * Adds unique chunk IDs.
 *
 * Metadata fields:
 * - id: Unique identifier (e.g., "doc-source-ch0")
 * - headingTrail: Array of parent headings (e.g., ["API", "Methods", "getData"])
 * - nodeTypes: Types of nodes in chunk (e.g., ["heading", "paragraph", "code"])
 * - tokenCount: Exact token count for this chunk
 * - source: Original file path/name if available
 * - index: Position in document (0-based)
 * - prevId/nextId: Links to adjacent chunks
 *
 * Used for:
 * - Retrieval context (heading trail helps understand where content belongs)
 * - Filtering (e.g., search only code chunks)
 * - Navigation (prev/next links)
 * - Debugging (source tracking)
 */

import { Chunk, ChunkOptions } from './types';
import { countTokens } from './tokenizer';

function generateChunkId(parentId: string, chunkNumber: number): string {
  return `${parentId}::ch${chunkNumber}`;
}

function extractHeading(content: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      return trimmed;
    }
  }
  return '';
}

function extractHeaderPath(chunk: Chunk): string[] {
  const existingHeaderPath = chunk.metadata?.headingTrail || chunk.metadata?.headerPath || [];
  if (Array.isArray(existingHeaderPath) && existingHeaderPath.length > 0) {
    return existingHeaderPath;
  }

  const heading = extractHeading(chunk.content);
  return heading ? [heading] : [];
}

function extractNodeTypes(chunk: Chunk): string[] {
  const existingTypes = chunk.metadata?.types || chunk.metadata?.nodeTypes || [];
  if (Array.isArray(existingTypes) && existingTypes.length > 0) {
    return existingTypes;
  }

  const nodeTypes = new Set<string>();
  const content = chunk.content;

  if (content.includes('#')) nodeTypes.add('heading');
  if (content.includes('```')) nodeTypes.add('code');
  if (content.includes('- ') || content.includes('* ') || /^\d+\./m.test(content)) nodeTypes.add('list-item');
  if (content.includes('|')) nodeTypes.add('table');
  if (content.includes('>')) nodeTypes.add('blockquote');
  nodeTypes.add('paragraph'); // Most chunks contain paragraph content

  return Array.from(nodeTypes);
}

function createTimestamp(): string {
  return new Date().toISOString();
}

function calculateSourcePosition(chunkNumber: number, chunks: Chunk[]): { charStart: number; charEnd: number; totalChars: number } {
  let charStart = 0;
  let totalLength = 0;

  // Calculate character positions based on chunk ordering
  for (let i = 0; i < chunks.length; i++) {
    const chunkLength = chunks[i].content.length;
    if (i === chunkNumber) {
      return {
        charStart,
        charEnd: charStart + chunkLength,
        totalChars: chunks.reduce((sum, c) => sum + c.content.length, 0)
      };
    }
    charStart += chunkLength;
    totalLength += chunkLength;
  }

  // Fallback if chunk not found
  return { charStart: 0, charEnd: 0, totalChars: totalLength };
}

export function attachMetadata(chunks: Chunk[], _options: ChunkOptions): Chunk[] {
  const contentType = 'doc'; // Default content type
  const source = 'chunker-output';
  const fileName = 'processed-content.md';
  const parentId = `${contentType}:${source}`;
  const timestamp = createTimestamp();

  return chunks.map((chunk, index) => {
    const chunkId = generateChunkId(parentId, index);
    const prevId = index > 0 ? generateChunkId(parentId, index - 1) : null;
    const nextId = index < chunks.length - 1 ? generateChunkId(parentId, index + 1) : null;

    const heading = extractHeading(chunk.content);
    const headerPath = extractHeaderPath(chunk);
    const nodeTypes = extractNodeTypes(chunk);
    const sourcePosition = calculateSourcePosition(index, chunks);
    const tokenCount = countTokens(chunk.content);

    return {
      ...chunk,
      tokens: tokenCount, // Update with accurate count
      metadata: {
        ...chunk.metadata,
        // Core identifiers
        id: chunkId,
        parentId,
        prevId,
        nextId,
        chunkNumber: index,

        // Structural information
        contentType,
        heading,
        headerPath,

        // Content analysis
        nodeTypes,
        tokenCount,

        // Source tracking
        source,
        fileName,
        timestamp,

        // Position tracking
        sourcePosition,

        // Additional metadata
        hasCode: nodeTypes.includes('code'),
        hasHeadings: nodeTypes.includes('heading'),
        hasLists: nodeTypes.includes('list-item'),
        contentLength: chunk.content.length
      }
    };
  });
}