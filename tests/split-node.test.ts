import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { splitOversized } from '../lib/split-node.ts';
import { countTokens } from '../lib/tokenizer.ts';
import { FlatNode } from '../lib/flatten-ast.ts';
import { ChunkOptions } from '../lib/types.ts';
import { parseMarkdown } from '../lib/parse-markdown';
import { flattenAst } from '../lib/flatten-ast';

describe('splitOversized', () => {
  const mockOptions: ChunkOptions = {
    minTokens: 50,
    maxTokens: 100,
    overlapSentences: 1
  };

  const createTestNode = (text: string, type: FlatNode['type'] = 'paragraph'): FlatNode => ({
    type,
    text,
    headingTrail: ['Test']
  });

  const loadFixtureNodes = (filename: string): FlatNode[] => {
    const content = readFileSync(`tests/fixtures/${filename}`, 'utf-8');
    const ast = parseMarkdown(content);
    return flattenAst(ast);
  };

  it('should not split nodes that fit within token limit', () => {
    const smallText = 'This is a short paragraph that fits within the token limit.';
    const nodes = [createTestNode(smallText)];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(smallText);
    expect(countTokens(result[0].text)).toBeLessThanOrEqual(mockOptions.maxTokens);
  });

  it('should split oversized nodes by paragraph breaks', () => {
    const nodes = loadFixtureNodes('large-nodes.md');

    const result = splitOversized(nodes, mockOptions, countTokens);

    // Should maintain or increase node count (split if needed)
    expect(result.length).toBeGreaterThanOrEqual(nodes.length);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
      expect(node.text.trim().length).toBeGreaterThan(0);
      expect(['heading', 'paragraph']).toContain(node.type);
    });

    // Verify no node exceeds token limits
    const oversizedNodes = result.filter(node => countTokens(node.text) > mockOptions.maxTokens);
    expect(oversizedNodes).toHaveLength(0);
  });

  it('should split by sentences when paragraph split is insufficient', () => {
    const longSentences = 'This is an extremely comprehensive and detailed sentence containing extensive technical explanations, methodological approaches, implementation strategies, architectural considerations, performance optimizations, security measures, and various other complex technical concepts that significantly exceed the established token limit threshold for comprehensive testing purposes. This is another exceptionally detailed and elaborate sentence that continues the established pattern of comprehensive content while adding substantial additional technical terminology, implementation details, architectural patterns, design principles, best practices, and extensive documentation that ensures we definitively surpass the maximum token limits. This is a third comprehensive sentence that maintains the pattern of extensive technical detail while incorporating additional complex concepts, methodological frameworks, implementation strategies, and comprehensive documentation approaches that guarantee exceeding token limits.';

    const nodes = [createTestNode(longSentences)];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result.length).toBeGreaterThan(1);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
    });
  });

  it('should split by lines when sentence split is insufficient', () => {
    const longLines = `Line one with extremely comprehensive and detailed content containing extensive technical explanations, methodological approaches, implementation strategies, architectural considerations, performance optimizations, security measures, and various complex technical concepts that significantly exceed normal limits for comprehensive testing purposes
Line two with substantial additional content that continues the established pattern of comprehensive technical documentation while incorporating detailed explanations, extensive implementation details, architectural patterns, design principles, best practices, and thorough analysis that ensures comprehensive testing coverage
Line three with even more extensive content designed to ensure proper testing coverage through detailed technical explanations, comprehensive methodological approaches, extensive documentation strategies, implementation techniques, and various other complex concepts that guarantee token limit exceedance
Line four with comprehensive additional content that maintains the pattern of extensive technical detail while incorporating substantial documentation, detailed implementation strategies, architectural considerations, and various other technical concepts to guarantee definitive token limit exceedance for testing purposes`;

    const nodes = [createTestNode(longLines)];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result.length).toBeGreaterThan(1);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
    });
  });

  it('should perform hard cut at word boundaries as last resort', () => {
    // Create a very long line with no natural break points
    const words = Array(150).fill('word').map((w, i) => `${w}${i}`);
    const longText = words.join(' ');

    const nodes = [createTestNode(longText)];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result.length).toBeGreaterThan(1);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
      expect(node.text.trim().length).toBeGreaterThan(0);
    });
  });

  it('should preserve node metadata during splitting', () => {
    const longText = `This is an extremely comprehensive and detailed paragraph containing extensive technical explanations, methodological approaches, implementation strategies, architectural considerations, performance optimizations, security measures, documentation standards, and various other complex technical concepts that significantly exceed the established token limit threshold and definitely requires splitting for comprehensive testing purposes.

This is another exceptionally detailed and elaborate paragraph that continues the established pattern of comprehensive content while adding substantial additional technical terminology, implementation details, architectural patterns, design principles, best practices, extensive documentation, and thorough analysis that ensures we definitively surpass the maximum token limits and requires proper splitting functionality.`;

    const testNode: FlatNode = {
      type: 'paragraph',
      text: longText,
      headingTrail: ['Chapter 1', 'Section A'],
      depth: 2,
      position: {
        start: { line: 1, column: 1, offset: 0 },
        end: { line: 5, column: 10, offset: 100 }
      }
    };

    const result = splitOversized([testNode], mockOptions, countTokens);

    expect(result.length).toBeGreaterThan(1);
    result.forEach(node => {
      expect(node.type).toBe('paragraph');
      expect(node.headingTrail).toEqual(['Chapter 1', 'Section A']);
      expect(node.depth).toBe(2);
      expect(node.position).toEqual(testNode.position);
    });
  });

  it('should handle multiple oversized nodes', () => {
    const longText1 = `First oversized paragraph with extremely comprehensive and detailed content containing extensive technical explanations, methodological approaches, implementation strategies, architectural considerations, performance optimizations, security measures, and various complex technical concepts designed to significantly exceed token limits for comprehensive testing purposes. This paragraph contains multiple intricate sentences with detailed explanations, comprehensive analysis, and thorough documentation of various technical concepts and implementation details.

Second paragraph within the first node that adds substantial additional content through detailed technical explanations, comprehensive methodological approaches, extensive documentation strategies, and implementation techniques that guarantee exceeding token limits while maintaining semantic coherence.`;

    const longText2 = `Second oversized paragraph with comprehensive different content but similar extensive length characteristics designed to exceed token limits through detailed technical explanations and comprehensive analysis. This also features multiple intricate sentences with detailed explanations, extensive implementation details, architectural patterns, design principles, and comprehensive documentation that ensures definitive token limit exceedance.

Another paragraph within the second node that incorporates substantial additional technical content, detailed implementation strategies, comprehensive methodological approaches, and extensive documentation that guarantees exceeding established token thresholds.`;

    const nodes = [
      createTestNode(longText1),
      createTestNode(longText2)
    ];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result.length).toBeGreaterThan(2);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
      expect(node.text.trim().length).toBeGreaterThan(0);
    });
  });

  it('should handle different node types', () => {
    const nodes = loadFixtureNodes('mixed-content.md');

    const result = splitOversized(nodes, mockOptions, countTokens);

    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
    });

    // Should preserve different node types
    const nodeTypes = [...new Set(result.map(n => n.type))];
    expect(nodeTypes.length).toBeGreaterThan(1);
  });

  it('should handle small nodes that do not need splitting', () => {
    const nodes = loadFixtureNodes('small-nodes.md');

    const result = splitOversized(nodes, mockOptions, countTokens);

    // Small nodes should not need splitting
    expect(result.length).toBe(nodes.length);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
    });
  });

  it('should handle edge case of empty or very short text', () => {
    const nodes = [
      createTestNode(''),
      createTestNode('Short'),
      createTestNode('   '),
    ];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result.length).toBeLessThanOrEqual(3);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
    });
  });

  it('should recursively split if initial split still exceeds limits', () => {
    // Create text where even individual paragraphs exceed token limits
    const hugeParagraph = Array(200).fill('This is a sentence with substantial content.').join(' ');

    const nodes = [createTestNode(hugeParagraph)];

    const result = splitOversized(nodes, mockOptions, countTokens);

    expect(result.length).toBeGreaterThan(1);
    result.forEach(node => {
      expect(countTokens(node.text)).toBeLessThanOrEqual(mockOptions.maxTokens);
      expect(node.text.trim().length).toBeGreaterThan(0);
    });
  });
});