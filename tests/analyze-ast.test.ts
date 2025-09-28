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
    it('should analyze simple.md with exact expected structure', () => {
      // simple.md contains:
      // - # Simple Document (H1)
      // - ## Heading Two (H2)
      // - ### Code Example (H3)
      // - ## Lists (H2)
      // - ## Table (H2)
      // = 5 headings total
      //
      // - 8 paragraphs (text content gets parsed into multiple paragraphs)
      // - 1 code block (javascript)
      // - 3 lists (nested lists count separately)
      // - 1 table

      const content = loadFixture('simple.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      expect(analysis.headingCount).toBe(5);
      expect(analysis.paragraphCount).toBe(8);
      expect(analysis.codeBlockCount).toBe(1);
      expect(analysis.listCount).toBe(3); // includes nested lists as separate
      expect(analysis.tableCount).toBe(1);
    });

    it('should analyze headings.md with exact heading structure', () => {
      // headings.md contains:
      // - # Main Title (H1)
      // - ## Section One (H2)
      // - ### Subsection A (H3)
      // - ### Subsection B (H3)
      // - ## Section Two (H2)
      // - #### Deep Heading (H4)
      // - ##### Even Deeper (H5)
      // - ## Final Section (H2)
      // = 8 headings total
      //
      // - 9 paragraphs (content gets parsed into multiple paragraphs)

      const content = loadFixture('headings.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      expect(analysis.headingCount).toBe(8);
      expect(analysis.paragraphCount).toBe(9);
      expect(analysis.codeBlockCount).toBe(0);
      expect(analysis.listCount).toBe(0);
      expect(analysis.tableCount).toBe(0);
    });

    it('should analyze mixed-content.md with expected variety', () => {
      // mixed-content.md contains:
      // - # Mixed Content Test Document (H1)
      // - ## Introduction (H2)
      // - ## Another Section (H2)
      // - ### Finally (H3)
      // = 4 headings total
      //
      // - 9 paragraphs (including blockquote content)
      // - 1 code block (javascript)
      // - 1 list (unordered)
      // - 0 tables

      const content = loadFixture('mixed-content.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      expect(analysis.headingCount).toBe(4);
      expect(analysis.paragraphCount).toBe(9);
      expect(analysis.codeBlockCount).toBe(1);
      expect(analysis.listCount).toBe(1);
      expect(analysis.tableCount).toBe(0);
    });

    it('should analyze code-heavy.md with multiple code blocks', () => {
      // code-heavy.md contains:
      // - # Code Examples (H1)
      // - ## TypeScript Function (H2)
      // - ## Python Code (H2)
      // - ## Inline Code (H2)
      // - ## Shell Commands (H2)
      // = 5 headings total
      //
      // - 1 paragraph (one with inline code)
      // - 3 code blocks (typescript, python, bash)
      // - 0 lists, 0 tables

      const content = loadFixture('code-heavy.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAst(ast);

      expect(analysis.headingCount).toBe(5);
      expect(analysis.paragraphCount).toBe(1);
      expect(analysis.codeBlockCount).toBe(3);
      expect(analysis.listCount).toBe(0);
      expect(analysis.tableCount).toBe(0);
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
  });

  describe('analyzeAstExtended function', () => {
    it('should provide detailed heading level analysis for headings.md', () => {
      const content = loadFixture('headings.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAstExtended(ast);

      expect(analysis.headingCount).toBe(8);

      // Expected heading levels:
      // H1: 1 (Main Title)
      // H2: 3 (Section One, Section Two, Final Section)
      // H3: 2 (Subsection A, Subsection B)
      // H4: 1 (Deep Heading)
      // H5: 1 (Even Deeper)
      expect(analysis.headingLevels[1]).toBe(1);
      expect(analysis.headingLevels[2]).toBe(3);
      expect(analysis.headingLevels[3]).toBe(2);
      expect(analysis.headingLevels[4]).toBe(1);
      expect(analysis.headingLevels[5]).toBe(1);

      // Should have no H6 headings
      expect(analysis.headingLevels[6]).toBeUndefined();
    });

    it('should detect blockquotes in mixed-content.md', () => {
      const content = loadFixture('mixed-content.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAstExtended(ast);

      // mixed-content.md has exactly 1 blockquote
      expect(analysis.blockquoteCount).toBe(1);
      expect(analysis.horizontalRuleCount).toBe(0);
      expect(analysis.hasFrontmatter).toBe(false);
    });

    it('should provide comprehensive metrics for simple.md', () => {
      const content = loadFixture('simple.md');
      const ast = parseMarkdown(content);
      const analysis = analyzeAstExtended(ast);

      // Verify all basic counts match
      expect(analysis.headingCount).toBe(5);
      expect(analysis.paragraphCount).toBe(8);
      expect(analysis.codeBlockCount).toBe(1);
      expect(analysis.listCount).toBe(3);
      expect(analysis.tableCount).toBe(1);

      // Heading level breakdown:
      // H1: 1, H2: 3, H3: 1
      expect(analysis.headingLevels[1]).toBe(1);
      expect(analysis.headingLevels[2]).toBe(3);
      expect(analysis.headingLevels[3]).toBe(1);

      // No advanced elements in simple.md
      expect(analysis.blockquoteCount).toBe(0);
      expect(analysis.horizontalRuleCount).toBe(0);
      expect(analysis.hasFrontmatter).toBe(false);
      expect(analysis.linkCount).toBe(0);
      expect(analysis.imageCount).toBe(0);
    });
  });

  describe('runAnalyzePipeline', () => {
    it('should analyze simple.md and provide complete context', () => {
      const content = loadFixture('simple.md');
      const result = runAnalyzePipeline(content, 'simple.md', defaultOptions);

      // Basic context validation
      expect(result.source.content).toBe(content);
      expect(result.source.title).toBe('simple.md');
      expect(result.source.length).toBe(458); // exact character count
      expect(result.source.tokens).toBeGreaterThan(100);
      expect(result.source.estimatedChunks).toBe(1); // fits in maxTokens

      // AST should be present
      expect(result.ast).toBeDefined();
      expect(result.ast!.type).toBe('root');

      // Structure analysis should match exact expectations
      expect(result.structure).toBeDefined();
      expect(result.structure!.headingCount).toBe(5);
      expect(result.structure!.paragraphCount).toBe(8);
      expect(result.structure!.codeBlockCount).toBe(1);
      expect(result.structure!.listCount).toBe(3);
      expect(result.structure!.tableCount).toBe(1);

      // Should have completed timer
      expect(result.timer.durationMs).toBeGreaterThan(0);
      expect(result.timer.endTime).toBeDefined();

      // Should NOT have chunks or stats (analysis pipeline stops early)
      expect(result.chunks).toBeUndefined();
      expect(result.stats).toBeUndefined();
    });

    it('should analyze headings.md with correct heading metrics', () => {
      const content = loadFixture('headings.md');
      const result = runAnalyzePipeline(content, 'headings.md', defaultOptions);

      expect(result.source.length).toBe(965); // exact character count
      expect(result.structure!.headingCount).toBe(8);
      expect(result.structure!.paragraphCount).toBe(9);
      expect(result.structure!.codeBlockCount).toBe(0);
      expect(result.structure!.listCount).toBe(0);
      expect(result.structure!.tableCount).toBe(0);
    });

    it('should analyze code-heavy.md with correct code block count', () => {
      const content = loadFixture('code-heavy.md');
      const result = runAnalyzePipeline(content, 'code-heavy.md', defaultOptions);

      expect(result.source.length).toBe(898); // exact character count
      expect(result.structure!.headingCount).toBe(5);
      expect(result.structure!.paragraphCount).toBe(1);
      expect(result.structure!.codeBlockCount).toBe(3); // typescript, python, bash
      expect(result.structure!.listCount).toBe(0);
      expect(result.structure!.tableCount).toBe(0);
    });

    it('should analyze mixed-content.md with blockquote detection', () => {
      const content = loadFixture('mixed-content.md');
      const result = runAnalyzePipeline(content, 'mixed-content.md', defaultOptions);

      expect(result.source.length).toBe(1306); // exact character count
      expect(result.structure!.headingCount).toBe(4);
      expect(result.structure!.paragraphCount).toBe(9);
      expect(result.structure!.codeBlockCount).toBe(1);
      expect(result.structure!.listCount).toBe(1);
      expect(result.structure!.tableCount).toBe(0);
    });

    it('should handle empty content with exact zero values', () => {
      const content = '';
      const result = runAnalyzePipeline(content, 'empty.md', defaultOptions);

      expect(result.source.length).toBe(0);
      expect(result.source.tokens).toBe(0);
      expect(result.source.estimatedChunks).toBe(1); // minimum is always 1

      expect(result.structure!.headingCount).toBe(0);
      expect(result.structure!.paragraphCount).toBe(0);
      expect(result.structure!.codeBlockCount).toBe(0);
      expect(result.structure!.listCount).toBe(0);
      expect(result.structure!.tableCount).toBe(0);
    });

    it('should provide fast analysis performance', () => {
      const content = loadFixture('code-heavy.md');
      const result = runAnalyzePipeline(content, 'code-heavy.md', defaultOptions);

      // Analysis-only pipeline should be very fast (no chunking overhead)
      expect(result.timer.durationMs).toBeLessThan(50);
    });
  });

  describe('Structure analysis validation', () => {
    it('should provide deterministic results', () => {
      const content = loadFixture('simple.md');

      const result1 = runAnalyzePipeline(content, 'test.md', defaultOptions);
      const result2 = runAnalyzePipeline(content, 'test.md', defaultOptions);

      // All analysis should be identical
      expect(result1.structure).toEqual(result2.structure);
      expect(result1.source.tokens).toBe(result2.source.tokens);
      expect(result1.source.length).toBe(result2.source.length);
    });

    it('should maintain count consistency in extended analysis', () => {
      const fixtures = ['simple.md', 'headings.md', 'code-heavy.md', 'mixed-content.md'];

      fixtures.forEach(fixture => {
        const content = loadFixture(fixture);
        const ast = parseMarkdown(content);

        const basicAnalysis = analyzeAst(ast);
        const extendedAnalysis = analyzeAstExtended(ast);

        // Extended analysis should have same basic counts
        expect(extendedAnalysis.headingCount).toBe(basicAnalysis.headingCount);
        expect(extendedAnalysis.paragraphCount).toBe(basicAnalysis.paragraphCount);
        expect(extendedAnalysis.codeBlockCount).toBe(basicAnalysis.codeBlockCount);
        expect(extendedAnalysis.listCount).toBe(basicAnalysis.listCount);
        expect(extendedAnalysis.tableCount).toBe(basicAnalysis.tableCount);

        // Heading levels should sum to total heading count
        const levelSum = Object.values(extendedAnalysis.headingLevels).reduce((sum, count) => sum + count, 0);
        expect(levelSum).toBe(extendedAnalysis.headingCount);
      });
    });

    it('should correctly analyze all fixture files with exact expectations', () => {
      const expectations = {
        'simple.md': {
          headings: 5, paragraphs: 8, code: 1, lists: 3, tables: 1, length: 458
        },
        'headings.md': {
          headings: 8, paragraphs: 9, code: 0, lists: 0, tables: 0, length: 965
        },
        'code-heavy.md': {
          headings: 5, paragraphs: 1, code: 3, lists: 0, tables: 0, length: 898
        },
        'mixed-content.md': {
          headings: 4, paragraphs: 9, code: 1, lists: 1, tables: 0, length: 1306
        }
      };

      Object.entries(expectations).forEach(([fixture, expected]) => {
        const content = loadFixture(fixture);
        const result = runAnalyzePipeline(content, fixture, defaultOptions);
        const structure = result.structure!;

        expect(structure.headingCount).toBe(expected.headings);
        expect(structure.paragraphCount).toBe(expected.paragraphs);
        expect(structure.codeBlockCount).toBe(expected.code);
        expect(structure.listCount).toBe(expected.lists);
        expect(structure.tableCount).toBe(expected.tables);
        expect(result.source.length).toBe(expected.length);
      });
    });
  });
});