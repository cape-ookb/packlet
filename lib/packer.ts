/**
 * packer.ts
 *
 * Accumulates nodes into chunks within min/max token budgets.
 *
 * Applies look-ahead merge for small nodes.
 * Flushes when near maxTokens.
 *
 * Packing algorithm:
 * 1. Initialize empty buffer and token count
 * 2. For each node:
 *    - If adding would exceed maxTokens, flush buffer
 *    - If buffer is below minTokens, try look-ahead merge
 *    - Add node to buffer and update token count
 * 3. Flush remaining buffer
 *
 * Look-ahead logic:
 * - If current chunk is small (< minTokens)
 * - Check if next node can fit without exceeding maxTokens
 * - Merge if possible to avoid tiny chunks
 *
 * Ensures all chunks (except possibly the last) meet minTokens requirement.
 */

import { FlatNode } from './flatten-ast';
import { ChunkOptions, Chunk } from './types';
import { countTokens } from './tokenizer';

function combineNodes(nodes: FlatNode[]): string {
  return nodes.map(node => node.text).join('\n\n');
}

function canAddNode(currentNodes: FlatNode[], nextNode: FlatNode, maxTokens: number): boolean {
  const combinedText = combineNodes([...currentNodes, nextNode]);
  return countTokens(combinedText) <= maxTokens;
}

function shouldLookAhead(currentNodes: FlatNode[], nextNode: FlatNode | undefined, options: ChunkOptions): boolean {
  if (!nextNode || currentNodes.length === 0) return false;

  const currentText = combineNodes(currentNodes);
  const currentTokens = countTokens(currentText);

  return currentTokens < options.minTokens &&
         canAddNode(currentNodes, nextNode, options.maxTokens);
}

function createChunk(nodes: FlatNode[]): Chunk {
  const content = combineNodes(nodes);

  // Use the headingTrail and headingDepths from the first node, which represents the hierarchical context
  const headingTrail = nodes[0]?.headingTrail || [];
  const headerDepths = nodes[0]?.headingDepths || [];

  return {
    content,
    tokens: countTokens(content),
    metadata: {
      nodeCount: nodes.length,
      types: Array.from(new Set(nodes.map(n => n.type))),
      headingTrail,
      headerDepths
    }
  };
}

function flushBuffer(buffer: FlatNode[], chunks: Chunk[]): void {
  if (buffer.length > 0) {
    chunks.push(createChunk(buffer));
    buffer.length = 0;
  }
}

function processNode(
  node: FlatNode,
  nextNode: FlatNode | undefined,
  buffer: FlatNode[],
  chunks: Chunk[],
  options: ChunkOptions,
  wouldBeSingleChunk: boolean
): void {
  // If this would be a single-chunk document, just accumulate everything
  if (wouldBeSingleChunk) {
    buffer.push(node);
    return; // Don't flush anything - let flushFinalBuffer handle it
  }

  // For multi-chunk documents, use normal logic
  if (!canAddNode(buffer, node, options.maxTokens)) {
    flushBuffer(buffer, chunks);
  }

  buffer.push(node);

  if (!shouldLookAhead(buffer, nextNode, options)) {
    const currentTokens = countTokens(combineNodes(buffer));

    // In multi-chunk documents, only flush if we meet minTokens
    if (currentTokens >= options.minTokens) {
      flushBuffer(buffer, chunks);
    }
    // If below minTokens, keep accumulating to avoid small chunks
  }
}

function flushFinalBuffer(buffer: FlatNode[], chunks: Chunk[], options: ChunkOptions, wouldBeSingleChunk: boolean): void {
  if (buffer.length > 0) {
    const currentTokens = countTokens(combineNodes(buffer));

    if (wouldBeSingleChunk || currentTokens >= options.minTokens) {
      // Allow: single chunk documents OR chunks that meet minTokens
      chunks.push(createChunk(buffer));
    } else {
      // Multi-chunk document with small final chunk - always merge with previous chunk
      if (chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        const lastChunkContent = lastChunk.originalText || lastChunk.content || '';
        const bufferContent = combineNodes(buffer);
        const mergedContent = lastChunkContent + '\n\n' + bufferContent;
        const mergedTokens = countTokens(mergedContent);

        // Always merge small final chunks, even if it exceeds maxTokens slightly
        // This prevents having tiny orphaned chunks at the end
        chunks[chunks.length - 1] = {
          ...lastChunk,
          content: mergedContent,
          tokens: mergedTokens
        };
      } else {
        // Shouldn't happen, but fallback - create the chunk anyway
        chunks.push(createChunk(buffer));
      }
    }
    buffer.length = 0;
  }
}

export function packNodes(nodes: FlatNode[], options: ChunkOptions): Chunk[] {
  const chunks: Chunk[] = [];
  const buffer: FlatNode[] = [];

  // First pass: determine if entire content would fit in single chunk
  const totalText = combineNodes(nodes);
  const totalTokens = countTokens(totalText);
  const wouldBeSingleChunk = totalTokens <= options.maxTokens;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nextNode = nodes[i + 1];
    processNode(node, nextNode, buffer, chunks, options, wouldBeSingleChunk);
  }

  // Final flush with single-chunk consideration
  flushFinalBuffer(buffer, chunks, options, wouldBeSingleChunk);
  return chunks;
}