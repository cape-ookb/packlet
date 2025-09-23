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
import GithubSlugger from 'github-slugger';

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

  const content = chunk.originalText || chunk.content || '';
  const heading = extractHeading(content);
  return heading ? [heading] : [];
}

function extractNodeTypes(chunk: Chunk): string[] {
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

function createTimestamp(): string {
  return new Date().toISOString();
}

function extractHeaderDepths(chunk: Chunk): number[] {
  // Use preserved depth information from packer if available
  const existingDepths = chunk.metadata?.headerDepths || [];
  if (Array.isArray(existingDepths) && existingDepths.length > 0) {
    return existingDepths;
  }

  // Fallback: derive depths from headerPath structure
  // This assumes proper hierarchical structure starting from depth 1
  const headerPath = extractHeaderPath(chunk);
  return headerPath.map((_, index) => index + 1);
}

function generateHeaderSlugs(headerPath: string[]): string[] {
  const slugger = new GithubSlugger();
  return headerPath.map(heading => {
    // Remove markdown # symbols if present
    const cleanHeading = heading.replace(/^#+\s*/, '');
    return slugger.slug(cleanHeading);
  });
}

function calculateSourcePosition(chunkNumber: number, chunks: Chunk[]): { charStart: number; charEnd: number; totalChars: number } {
  let charStart = 0;
  let totalLength = 0;

  // Calculate character positions based on chunk ordering
  for (let i = 0; i < chunks.length; i++) {
    const chunkLength = (chunks[i].originalText || chunks[i].content || '').length;
    if (i === chunkNumber) {
      return {
        charStart,
        charEnd: charStart + chunkLength,
        totalChars: chunks.reduce((sum, c) => sum + (c.originalText || c.content || '').length, 0)
      };
    }
    charStart += chunkLength;
    totalLength += chunkLength;
  }

  // Fallback if chunk not found
  return { charStart: 0, charEnd: 0, totalChars: totalLength };
}

export function attachMetadata(chunks: Chunk[], options: ChunkOptions, fileTitle?: string): Chunk[] {
  const contentType = 'doc'; // Default content type
  const sourceFile = 'processed-content.md'; // Default source file name
  const parentId = `${contentType}:${sourceFile}`;
  const processedAt = createTimestamp();
  const startTime = performance.now();

  const result = chunks.map((chunk, index) => {
    // Core identifiers
    const chunkId = generateChunkId(parentId, index);
    const prevId = index > 0 ? generateChunkId(parentId, index - 1) : null;
    const nextId = index < chunks.length - 1 ? generateChunkId(parentId, index + 1) : null;

    // Extract structural information
    // Get content for processing (prefer existing content during pipeline)
    const content = chunk.content || chunk.originalText || '';

    const headerPath = extractHeaderPath(chunk);
    const headerDepths = extractHeaderDepths(chunk);
    const headerSlugs = generateHeaderSlugs(headerPath);
    const nodeTypes = extractNodeTypes(chunk);
    const sourcePosition = calculateSourcePosition(index, chunks);
    const tokenCount = chunk.tokens || countTokens(content);

    // Build derived fields
    const headerBreadcrumb = headerPath.join(' > ');
    const sectionTitle = headerPath.length > 0 ? headerPath[headerPath.length - 1] : '';
    const sectionSlug = headerSlugs.length > 0 ? headerSlugs[headerSlugs.length - 1] : '';

    // Calculate estimated tokens (rough character-based estimate)
    const estimatedTokens = Math.ceil(content.length / 3.8);

    return {
      // Core identifiers
      id: chunkId,
      parentId,
      prevId,
      nextId,

      // Content fields
      embedText: content.trim(), // Will be updated in embed text generation phase
      originalText: content.trim(),

      // Position tracking
      sourcePosition,

      // Token information
      tokenStats: {
        tokens: tokenCount,
        estimatedTokens
      },

      // Pipeline information (will be updated later)
      pipeline: {
        version: '1.0.0',
        processingTimeMs: 0 // Will be calculated at end
      },

      // Structural information
      chunkNumber: index,

      // Chunking configuration used to generate this chunk
      chunkingOptions: options,

      // Metadata object (for vector database filtering)
      metadata: {
        // Preserve existing metadata
        ...chunk.metadata,
        // Override with new computed metadata
        contentType,
        sectionTitle,
        headerPath,
        fileTitle: fileTitle || 'untitled',
        headerBreadcrumb,
        headerDepths,
        headerSlugs,
        sectionSlug,
        sourceFile,
        nodeTypes,
        processedAt
      }
    };
  });

  // Update pipeline processing time for all chunks
  const endTime = performance.now();
  const processingTimeMs = Math.round(endTime - startTime);

  return result.map(chunk => ({
    ...chunk,
    pipeline: {
      ...chunk.pipeline,
      processingTimeMs
    }
  }));
}