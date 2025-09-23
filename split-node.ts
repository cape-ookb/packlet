/**
 * split-node.ts
 *
 * Implements recursive splitting logic (paragraph → sentence → hard cut).
 *
 * Input: oversized node. Output: array of smaller nodes.
 *
 * Splitting hierarchy:
 * 1. Try splitting on paragraph breaks (\n\n)
 * 2. Try splitting on sentence boundaries (. ! ?)
 * 3. Try splitting on line breaks (\n)
 * 4. Last resort: hard cut at word boundaries
 *
 * Each split preserves:
 * - Node type information
 * - Heading trail context
 * - Position data for source mapping
 *
 * Recursively splits until all nodes fit within maxTokens.
 */

import { FlatNode } from './flatten-ast';
import { ChunkOptions } from './types';

function splitByParagraphs(text: string): string[] {
  return text.split('\n\n').filter(p => p.trim().length > 0);
}

function splitBySentences(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  return sentences.length > 0 ? sentences : [text];
}

function splitByLines(text: string): string[] {
  return text.split('\n').filter(line => line.trim().length > 0);
}

function hardCutAtWords(text: string, maxTokens: number, countTokens: Function): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
    if (countTokens(testChunk) <= maxTokens) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        chunks.push(word);
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

function splitNode(node: FlatNode, maxTokens: number, countTokens: Function): FlatNode[] {
  if (countTokens(node.text) <= maxTokens) {
    return [node];
  }

  const strategies = [
    () => splitByParagraphs(node.text),
    () => splitBySentences(node.text),
    () => splitByLines(node.text),
    () => hardCutAtWords(node.text, maxTokens, countTokens)
  ];

  for (const splitStrategy of strategies) {
    const parts = splitStrategy();
    if (parts.length > 1) {
      const splitNodes: FlatNode[] = [];

      for (const part of parts) {
        const newNode: FlatNode = {
          ...node,
          text: part.trim()
        };

        if (countTokens(newNode.text) <= maxTokens) {
          splitNodes.push(newNode);
        } else {
          splitNodes.push(...splitNode(newNode, maxTokens, countTokens));
        }
      }

      return splitNodes.filter(n => n.text.length > 0);
    }
  }

  return [node];
}

export function splitOversized(nodes: FlatNode[], options: ChunkOptions, countTokens: Function): FlatNode[] {
  const result: FlatNode[] = [];

  for (const node of nodes) {
    if (countTokens(node.text) > options.maxTokens) {
      result.push(...splitNode(node, options.maxTokens, countTokens));
    } else {
      result.push(node);
    }
  }

  return result;
}