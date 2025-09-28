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

  // Always look ahead if below minTokens
  if (currentTokens < options.minTokens) {
    return canAddNode(currentNodes, nextNode, options.maxTokens);
  }

  // Also look ahead if we're below target and adding the next node would get us closer to target
  const targetTokens = options.targetTokens || options.maxTokens * 0.8;
  if (currentTokens < targetTokens && canAddNode(currentNodes, nextNode, options.maxTokens)) {
    const potentialTokens = countTokens(combineNodes([...currentNodes, nextNode]));

    // Safety check: don't look ahead if it would make us significantly exceed target
    if (potentialTokens > targetTokens * 1.3) {
      return false;
    }

    const currentDistance = Math.abs(currentTokens - targetTokens);
    const potentialDistance = Math.abs(potentialTokens - targetTokens);

    // Look ahead if it gets us closer to target
    return potentialDistance < currentDistance;
  }

  return false;
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

  // For multi-chunk documents, check if adding this node would exceed maxTokens
  if (!canAddNode(buffer, node, options.maxTokens)) {
    flushBuffer(buffer, chunks);
  }

  buffer.push(node);

  // Check if we should flush the current buffer
  const currentTokens = countTokens(combineNodes(buffer));

  // Always flush if we're at or near maxTokens, regardless of target optimization
  if (currentTokens >= options.maxTokens * 0.9) {
    flushBuffer(buffer, chunks);
    return;
  }

  // For smaller chunks, use target-aware logic
  if (!shouldLookAhead(buffer, nextNode, options)) {
    // In multi-chunk documents, flush if we meet minTokens AND either:
    // 1. We're at or above target tokens, OR
    // 2. We don't have a next node to consider, OR
    // 3. Adding the next node wouldn't improve our distance to target
    if (currentTokens >= options.minTokens) {
      const targetTokens = options.targetTokens || options.maxTokens * 0.8;
      const shouldFlush = currentTokens >= targetTokens ||
                         !nextNode ||
                         !canAddNode(buffer, nextNode, options.maxTokens);

      if (shouldFlush) {
        flushBuffer(buffer, chunks);
      }
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

        // Merge small final chunks, but respect maxTokens hard limit
        if (mergedTokens <= options.maxTokens) {
          chunks[chunks.length - 1] = {
            ...lastChunk,
            content: mergedContent,
            tokens: mergedTokens
          };
        } else {
          // If merging would exceed maxTokens, create separate chunk
          chunks.push(createChunk(buffer));
        }
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