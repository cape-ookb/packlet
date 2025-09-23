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

function combineNodes(nodes: FlatNode[]): string {
  return nodes.map(node => node.text).join('\n\n');
}

function canAddNode(currentNodes: FlatNode[], nextNode: FlatNode, maxTokens: number, countTokens: Function): boolean {
  const combinedText = combineNodes([...currentNodes, nextNode]);
  return countTokens(combinedText) <= maxTokens;
}

function shouldLookAhead(currentNodes: FlatNode[], nextNode: FlatNode | undefined, options: ChunkOptions, countTokens: Function): boolean {
  if (!nextNode || currentNodes.length === 0) return false;

  const currentText = combineNodes(currentNodes);
  const currentTokens = countTokens(currentText);

  return currentTokens < options.minTokens &&
         canAddNode(currentNodes, nextNode, options.maxTokens, countTokens);
}

function createChunk(nodes: FlatNode[], countTokens: Function): Chunk {
  const content = combineNodes(nodes);
  return {
    content,
    tokens: countTokens(content),
    metadata: {
      nodeCount: nodes.length,
      types: Array.from(new Set(nodes.map(n => n.type))),
      headingTrail: nodes[0]?.headingTrail || []
    }
  };
}

function flushBuffer(buffer: FlatNode[], chunks: Chunk[], countTokens: Function): void {
  if (buffer.length > 0) {
    chunks.push(createChunk(buffer, countTokens));
    buffer.length = 0;
  }
}

function processNode(
  node: FlatNode,
  nextNode: FlatNode | undefined,
  buffer: FlatNode[],
  chunks: Chunk[],
  options: ChunkOptions,
  countTokens: Function
): void {
  if (!canAddNode(buffer, node, options.maxTokens, countTokens)) {
    flushBuffer(buffer, chunks, countTokens);
  }

  buffer.push(node);

  if (!shouldLookAhead(buffer, nextNode, options, countTokens)) {
    const currentTokens = countTokens(combineNodes(buffer));
    if (currentTokens >= options.minTokens || !nextNode) {
      flushBuffer(buffer, chunks, countTokens);
    }
  }
}

export function packNodes(nodes: FlatNode[], options: ChunkOptions, countTokens: Function): Chunk[] {
  const chunks: Chunk[] = [];
  const buffer: FlatNode[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nextNode = nodes[i + 1];
    processNode(node, nextNode, buffer, chunks, options, countTokens);
  }

  flushBuffer(buffer, chunks, countTokens);
  return chunks;
}