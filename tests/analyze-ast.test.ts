/**
 * analyze-ast.test.ts
 *
 * Tests for AST analysis functionality using the runAnalyzePipeline.
 * Tests structure analysis in isolation without chunking overhead.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { runAnalyzePipeline } from '../lib/index';
import { analyzeAst, analyzeAstExtended } from '../lib/analyze-ast';
import { parseMarkdown } from '../lib/parse-markdown';
import { withDefaults } from '../lib/default-config';

describe('AST Analysis', () => {
  // Load test fixtures
  const loadFixture = (filename: string): string => {
    return readFileSync(join(__dirname, 'fixtures', filename), 'utf-8');
  };

  const defaultOptions = withDefaults({ maxTokens: 512, minTokens: 64, overlapSentences: 1 });

  describe('analyzeAst function', () => {
    it('should analyze mixed-content.md fixture', () => {
      const content = loadFixture('mixed-content.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      // Verify basic structure analysis works
      expect(analysis.headingCount).toBeGreaterThan(0);
      expect(analysis.paragraphCount).toBeGreaterThan(0);
      expect(typeof analysis.codeBlockCount).toBe('number');
      expect(typeof analysis.listCount).toBe('number');
      expect(typeof analysis.tableCount).toBe('number');
    });

    it('should handle simple documents', () => {
      const content = loadFixture('simple.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      // Simple.md should have basic structure
      expect(analysis.headingCount).toBeGreaterThan(0);
      expect(analysis.paragraphCount).toBeGreaterThan(0);
    });

    it('should handle empty documents', () => {
      const content = '';
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      expect(analysis.headingCount).toBe(0);
      expect(analysis.paragraphCount).toBe(0);
      expect(analysis.codeBlockCount).toBe(0);
      expect(analysis.listCount).toBe(0);
      expect(analysis.tableCount).toBe(0);
    });

    it('should analyze code-heavy documents', () => {
      const content = loadFixture('code-heavy.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      // Code-heavy.md should have code blocks
      expect(analysis.codeBlockCount).toBeGreaterThan(0);
    });
  });

  describe('analyzeAstExtended function', () => {
    it('should provide extended analysis with heading levels', () => {
      const content = loadFixture('headings.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAstExtended(ast);

      expect(analysis.headingCount).toBeGreaterThan(0);
      expect(Object.keys(analysis.headingLevels).length).toBeGreaterThan(0);
      // Should have heading level counts
      const totalHeadingsFromLevels = Object.values(analysis.headingLevels).reduce((sum, count) => sum + count, 0);
      expect(totalHeadingsFromLevels).toBe(analysis.headingCount);
    });

    it('should detect various markdown elements', () => {
      const content = loadFixture('mixed-content.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAstExtended(ast);

      // Should provide extended metrics
      expect(typeof analysis.linkCount).toBe('number');
      expect(typeof analysis.imageCount).toBe('number');
      expect(typeof analysis.blockquoteCount).toBe('number');
    });

    it('should analyze skeleton document', () => {
      const content = loadFixture('skeleton-250.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAstExtended(ast);

      // Large document should have comprehensive structure
      expect(analysis.headingCount).toBeGreaterThan(5);
      expect(analysis.paragraphCount).toBeGreaterThan(10);
    });
  });

  describe('runAnalyzePipeline', () => {
    it('should analyze simple.md fixture', () => {
      const content = loadFixture('simple.md');
      const result = runAnalyzePipeline(content, 'simple.md', defaultOptions);

      // Should have all the basic context fields
      expect(result.source.content).toBe(content);
      expect(result.source.title).toBe('simple.md');
      expect(result.source.tokens).toBeGreaterThan(0);
      expect(result.source.estimatedChunks).toBeGreaterThan(0);

      // Should have AST
      expect(result.ast).toBeDefined();

      // Should have structure analysis
      expect(result.structure).toBeDefined();
      expect(result.structure!.headingCount).toBeGreaterThan(0);
      expect(result.structure!.paragraphCount).toBeGreaterThan(0);

      // Should have timing info
      expect(result.timer.durationMs).toBeGreaterThan(0);

      // Should NOT have chunks (since we stopped before chunking)
      expect(result.chunks).toBeUndefined();
      expect(result.stats).toBeUndefined();
    });

    it('should analyze headings.md fixture', () => {
      const content = loadFixture('headings.md');
      const result = runAnalyzePipeline(content, 'headings.md', defaultOptions);

      expect(result.structure).toBeDefined();

      // headings.md should have multiple headings
      expect(result.structure!.headingCount).toBeGreaterThanOrEqual(3);

      // Should have some paragraphs
      expect(result.structure!.paragraphCount).toBeGreaterThan(0);
    });

    it('should analyze code-heavy.md fixture', () => {
      const content = loadFixture('code-heavy.md');
      const result = runAnalyzePipeline(content, 'code-heavy.md', defaultOptions);

      expect(result.structure).toBeDefined();

      // code-heavy.md should have code blocks
      expect(result.structure!.codeBlockCount).toBeGreaterThan(0);
    });

    it('should analyze mixed-content.md fixture', () => {
      const content = loadFixture('mixed-content.md');
      const result = runAnalyzePipeline(content, 'mixed-content.md', defaultOptions);

      expect(result.structure).toBeDefined();

      // mixed-content.md should have various elements
      const structure = result.structure!;
      expect(structure.headingCount + structure.paragraphCount + structure.listCount).toBeGreaterThan(3);
    });

    it('should handle empty content gracefully', () => {
      const content = '';
      const result = runAnalyzePipeline(content, 'empty.md', defaultOptions);

      expect(result.structure).toBeDefined();
      expect(result.structure!.headingCount).toBe(0);
      expect(result.structure!.paragraphCount).toBe(0);
      expect(result.structure!.codeBlockCount).toBe(0);
      expect(result.structure!.listCount).toBe(0);
      expect(result.structure!.tableCount).toBe(0);
    });

    it('should provide performance metrics', () => {
      const content = loadFixture('large-nodes.md');
      const result = runAnalyzePipeline(content, 'large-nodes.md', defaultOptions);

      // Should complete quickly (analysis only, no chunking)
      expect(result.timer.durationMs).toBeLessThan(100); // Should be very fast

      // Should have source metrics
      expect(result.source.length).toBe(content.length);
      expect(result.source.tokens).toBeGreaterThan(0);
    });
  });

  describe('Structure analysis validation', () => {
    it('should provide consistent analysis across multiple runs', () => {
      const content = loadFixture('multi-h1.md');

      // Run analysis multiple times
      const result1 = runAnalyzePipeline(content, 'test.md', defaultOptions);
      const result2 = runAnalyzePipeline(content, 'test.md', defaultOptions);

      // Results should be identical (deterministic)
      expect(result1.structure).toEqual(result2.structure);
      expect(result1.source.tokens).toBe(result2.source.tokens);
    });

    it('should handle complex document structures', () => {
      const content = loadFixture('large-nodes.md');
      const result = runAnalyzePipeline(content, 'large-nodes.md', defaultOptions);
      const structure = result.structure!;

      // Verify comprehensive analysis
      expect(structure.headingCount).toBeGreaterThan(0);
      expect(structure.paragraphCount).toBeGreaterThan(0);
      expect(typeof structure.codeBlockCount).toBe('number');
      expect(typeof structure.listCount).toBe('number');
      expect(typeof structure.tableCount).toBe('number');
    });

    it('should analyze all available fixtures', () => {
      const fixtures = [
        'simple.md',
        'headings.md',
        'code-heavy.md',
        'mixed-content.md',
        'multi-h1.md',
        'messy-content.md'
      ];

      fixtures.forEach(fixture => {
        const content = loadFixture(fixture);
        const result = runAnalyzePipeline(content, fixture, defaultOptions);

        // Each fixture should produce valid structure analysis
        expect(result.structure).toBeDefined();
        expect(typeof result.structure!.headingCount).toBe('number');
        expect(typeof result.structure!.paragraphCount).toBe('number');
        expect(typeof result.structure!.codeBlockCount).toBe('number');
        expect(typeof result.structure!.listCount).toBe('number');
        expect(typeof result.structure!.tableCount).toBe('number');

        // Should have timing
        expect(result.timer.durationMs).toBeGreaterThan(0);
      });
    });
  });
});