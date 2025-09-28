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
import { createTimestamp, generateChunkId } from './utils';
import { extractHeading, extractNodeTypes } from './markdown-utils';
import { resetSlugger, generateHeaderSlugs } from './slug-utils';

// Re-export for backward compatibility
export { resetSlugger } from './slug-utils';


function extractHeaderPath(chunk: Chunk): string[] {
  const existingHeaderPath = chunk.metadata?.headingTrail || chunk.metadata?.headerPath || [];
  if (Array.isArray(existingHeaderPath) && existingHeaderPath.length > 0) {
    return existingHeaderPath;
  }

  const content = chunk.originalText || chunk.content || '';
  const heading = extractHeading(content);
  return heading ? [heading] : [];
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

function generateChunkIds(parentId: string, index: number, totalChunks: number): {
  chunkId: string;
  prevId: string | null;
  nextId: string | null;
} {
  const chunkId = generateChunkId(parentId, index);
  const prevId = index > 0 ? generateChunkId(parentId, index - 1) : null;
  const nextId = index < totalChunks - 1 ? generateChunkId(parentId, index + 1) : null;

  return { chunkId, prevId, nextId };
}

function resolveChunkContent(chunk: Chunk): string {
  return chunk.content || chunk.originalText || '';
}

function extractStructuralData(chunk: Chunk, index: number, chunks: Chunk[]): {
  headerPath: string[];
  headerDepths: number[];
  headerSlugs: string[];
  nodeTypes: string[];
  sourcePosition: { charStart: number; charEnd: number; totalChars: number };
  tokenCount: number;
} {
  const content = resolveChunkContent(chunk);
  const headerPath = extractHeaderPath(chunk);
  const headerDepths = extractHeaderDepths(chunk);
  const headerSlugs = generateHeaderSlugs(headerPath);
  const nodeTypes = extractNodeTypes(chunk);
  const sourcePosition = calculateSourcePosition(index, chunks);
  const tokenCount = chunk.tokens || countTokens(content);

  return {
    headerPath,
    headerDepths,
    headerSlugs,
    nodeTypes,
    sourcePosition,
    tokenCount
  };
}

function createDerivedFields(headerPath: string[], headerSlugs: string[], content: string): {
  headerBreadcrumb: string;
  sectionTitle: string;
  sectionSlug: string;
  estimatedTokens: number;
} {
  const headerBreadcrumb = headerPath.join(' > ');
  const sectionTitle = headerPath.length > 0 ? headerPath[headerPath.length - 1] : '';
  const sectionSlug = headerSlugs.length > 0 ? headerSlugs[headerSlugs.length - 1] : '';
  const estimatedTokens = Math.ceil(content.length / 3.8);

  return {
    headerBreadcrumb,
    sectionTitle,
    sectionSlug,
    estimatedTokens
  };
}

type MetadataContext = {
  ids: ReturnType<typeof generateChunkIds>;
  structural: ReturnType<typeof extractStructuralData>;
  derived: ReturnType<typeof createDerivedFields>;
  options: ChunkOptions;
  fileTitle?: string;
  contentType: string;
  sourceFile: string;
  processedAt: string;
  index: number;
};

function buildChunkMetadata(chunk: Chunk, context: MetadataContext): Chunk {
  const content = resolveChunkContent(chunk).trim();
  const { ids, structural, derived, options, fileTitle, contentType, sourceFile, processedAt, index } = context;
  const parentId = ids.chunkId.split('::')[0];

  return {
    ...chunk,
    id: ids.chunkId,
    parentId,
    prevId: ids.prevId,
    nextId: ids.nextId,
    content: chunk.content || content,
    embedText: content,
    originalText: content,
    tokens: chunk.tokens || structural.tokenCount,
    sourcePosition: structural.sourcePosition,
    tokenStats: {
      tokens: structural.tokenCount,
      estimatedTokens: derived.estimatedTokens
    },
    pipeline: {
      version: '1.0.0',
      processingTimeMs: 0
    },
    chunkNumber: index,
    chunkingOptions: options,
    metadata: {
      ...chunk.metadata,
      contentType,
      sectionTitle: derived.sectionTitle,
      headerPath: structural.headerPath,
      fileTitle: fileTitle || 'untitled',
      headerBreadcrumb: derived.headerBreadcrumb,
      headerDepths: structural.headerDepths,
      headerSlugs: structural.headerSlugs,
      sectionSlug: derived.sectionSlug,
      sourceFile,
      nodeTypes: structural.nodeTypes,
      processedAt
    }
  };
}

function updatePipelineTimings(chunks: Chunk[], processingTimeMs: number): Chunk[] {
  return chunks.map(chunk => ({
    ...chunk,
    pipeline: {
      version: chunk.pipeline?.version || '1.0.0',
      processingTimeMs
    }
  }));
}

export function attachMetadata(chunks: Chunk[], options: ChunkOptions, fileTitle?: string): Chunk[] {
  resetSlugger();

  const contentType = 'doc';
  const sourceFile = 'processed-content.md';
  const parentId = `${contentType}:${sourceFile}`;
  const processedAt = createTimestamp();
  const startTime = performance.now();

  const result = chunks.map((chunk, index) => {
    const ids = generateChunkIds(parentId, index, chunks.length);
    const structural = extractStructuralData(chunk, index, chunks);
    const content = resolveChunkContent(chunk);
    const derived = createDerivedFields(structural.headerPath, structural.headerSlugs, content);

    const context: MetadataContext = {
      ids,
      structural,
      derived,
      options,
      fileTitle,
      contentType,
      sourceFile,
      processedAt,
      index
    };

    return buildChunkMetadata(chunk, context);
  });

  const processingTimeMs = Math.round(performance.now() - startTime);
  return updatePipelineTimings(result, processingTimeMs);
}