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

function processWord(word: string, currentChunk: string, chunks: string[], maxTokens: number, countTokens: Function): string {
  const testChunk = currentChunk ? `${currentChunk} ${word}` : word;

  if (countTokens(testChunk) <= maxTokens) {
    return testChunk;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
    return word;
  }

  chunks.push(word);
  return '';
}

function hardCutAtWords(text: string, maxTokens: number, countTokens: Function): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    currentChunk = processWord(word, currentChunk, chunks, maxTokens, countTokens);
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks.length > 0 ? chunks : [text];
}

function createSplitNode(node: FlatNode, part: string): FlatNode {
  return {
    ...node,
    text: part.trim()
  };
}

function processPart(node: FlatNode, part: string, maxTokens: number, countTokens: Function): FlatNode[] {
  const newNode = createSplitNode(node, part);

  if (countTokens(newNode.text) <= maxTokens) {
    return [newNode];
  }

  return splitNode(newNode, maxTokens, countTokens);
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
      const splitNodes = parts.flatMap(part =>
        processPart(node, part, maxTokens, countTokens)
      );
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