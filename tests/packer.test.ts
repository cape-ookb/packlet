import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { packNodes } from '../packer';
import { countTokens } from '../tokenizer';
import { FlatNode } from '../flatten-ast';
import { ChunkOptions } from '../types';
import { parseMarkdown } from '../parse-markdown';
import { flattenAst } from '../flatten-ast';

describe('packNodes', () => {
  const mockOptions: ChunkOptions = {
    minTokens: 50,
    maxTokens: 150,
    overlapSentences: 1
  };

  const createTestNode = (text: string, type: FlatNode['type'] = 'paragraph'): FlatNode => ({
    type,
    text,
    headingTrail: ['Test Section']
  });

  const loadFixtureNodes = (filename: string): FlatNode[] => {
    const content = readFileSync(`tests/fixtures/${filename}`, 'utf-8');
    const ast = parseMarkdown(content);
    return flattenAst(ast);
  };

  it('should never exceed max tokens', () => {
    const nodes = [
      createTestNode('This is a medium-length paragraph with substantial content that should contribute significantly to token count for comprehensive testing purposes.'),
      createTestNode('Another substantial paragraph with extensive content designed to test the packing algorithm and ensure proper token management throughout the process.'),
      createTestNode('A third comprehensive paragraph with detailed explanations and extensive content that continues the pattern of substantial text for testing purposes.'),
      createTestNode('Final paragraph with comprehensive content to complete the test scenario with substantial token contribution for algorithm validation.')
    ];

    const chunks = packNodes(nodes, mockOptions, countTokens);

    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
      expect(chunk.tokens).toBeGreaterThan(0);
    });
  });

  it('should respect minimum token requirements with look-ahead', () => {
    const shortNodes = loadFixtureNodes('small-nodes.md');

    const chunks = packNodes(shortNodes, mockOptions, countTokens);

    // Most chunks should meet minimum (except possibly the last)
    const nonLastChunks = chunks.slice(0, -1);
    nonLastChunks.forEach(chunk => {
      expect(chunk.tokens).toBeGreaterThanOrEqual(mockOptions.minTokens);
    });
  });

  it('should handle single large node that fits', () => {
    const largeText = 'This is a comprehensive paragraph with substantial content containing extensive technical explanations, methodological approaches, and detailed implementation strategies that fit within the maximum token limit.';
    const nodes = [createTestNode(largeText)];

    const chunks = packNodes(nodes, mockOptions, countTokens);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
    expect(chunks[0].content).toBe(largeText);
  });

  it('should combine multiple small nodes into single chunk', () => {
    const smallNodes = [
      createTestNode('Small node one.'),
      createTestNode('Small node two.'),
      createTestNode('Small node three.')
    ];

    const chunks = packNodes(smallNodes, mockOptions, countTokens);

    expect(chunks.length).toBeLessThan(smallNodes.length);
    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
    });

    // Verify content is properly combined
    const allOriginalText = smallNodes.map(n => n.text).join('\n\n');
    const allChunkText = chunks.map(c => c.content).join('\n\n');
    expect(allChunkText).toBe(allOriginalText);
  });

  it('should preserve node metadata in chunks', () => {
    const nodes = [
      { ...createTestNode('Paragraph content.'), type: 'paragraph' as const },
      { ...createTestNode('Heading content.'), type: 'heading' as const, depth: 1 },
      { ...createTestNode('Code content.'), type: 'code' as const, lang: 'javascript' }
    ];

    const chunks = packNodes(nodes, mockOptions, countTokens);

    chunks.forEach(chunk => {
      expect(chunk.metadata).toBeDefined();
      expect(chunk.metadata?.nodeCount).toBeGreaterThan(0);
      expect(Array.isArray(chunk.metadata?.types)).toBe(true);
      expect(Array.isArray(chunk.metadata?.headingTrail)).toBe(true);
    });
  });

  it('should handle empty input', () => {
    const chunks = packNodes([], mockOptions, countTokens);
    expect(chunks).toEqual([]);
  });

  it('should handle single node input', () => {
    const node = createTestNode('Single node content for testing purposes.');
    const chunks = packNodes([node], mockOptions, countTokens);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(node.text);
    expect(chunks[0].tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
  });

  it('should demonstrate look-ahead merging behavior', () => {
    // Create nodes where first is small, second would fit if combined
    const nodes = [
      createTestNode('Small paragraph.'), // Small
      createTestNode('Medium-sized paragraph with additional content.'), // Medium
      createTestNode('Another medium-sized paragraph with substantial content for testing.')
    ];

    const chunks = packNodes(nodes, mockOptions, countTokens);

    // Should look ahead and combine first two if they fit together
    const firstChunkTokens = countTokens(chunks[0].content);
    expect(firstChunkTokens).toBeGreaterThan(countTokens(nodes[0].text));
  });

  it('should flush buffer when adding next node would exceed max tokens', () => {
    const largeNodes = loadFixtureNodes('large-nodes.md');

    const chunks = packNodes(largeNodes, mockOptions, countTokens);

    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
    });

    // Should create multiple chunks since nodes are large
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle different node types', () => {
    const mixedNodes = loadFixtureNodes('mixed-content.md');

    const chunks = packNodes(mixedNodes, mockOptions, countTokens);

    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
      expect(chunk.metadata?.types).toBeDefined();
    });

    // Should have variety of node types
    const allTypes = chunks.flatMap(c => c.metadata?.types || []);
    expect(new Set(allTypes).size).toBeGreaterThan(1);
  });

  it('should maintain correct token counts in chunk metadata', () => {
    const nodes = [
      createTestNode('Test content for token counting verification purposes.')
    ];

    const chunks = packNodes(nodes, mockOptions, countTokens);

    chunks.forEach(chunk => {
      const actualTokens = countTokens(chunk.content);
      expect(chunk.tokens).toBe(actualTokens);
    });
  });

  it('should handle very small chunks at the end', () => {
    const nodes = [
      createTestNode('Large paragraph with substantial content that approaches the maximum token limit through extensive explanations and detailed technical documentation ensuring comprehensive testing coverage.'),
      createTestNode('Tiny.'), // Very small final node
    ];

    const chunks = packNodes(nodes, mockOptions, countTokens);

    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(mockOptions.maxTokens);
    });

    // Last chunk might be small, which is acceptable
    expect(chunks.length).toBeGreaterThan(0);
  });
});