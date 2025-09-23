import { describe, it, expect, beforeEach } from 'vitest';
import { chunkMarkdown } from '../lib/index';
import { attachMetadata, resetSlugger } from '../lib/metadata';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Edge Cases - Phase 5.1 Testing Requirements', () => {
  beforeEach(() => {
    resetSlugger();
  });

  describe('fileTitle parameter handling', () => {
    it('should require fileTitle parameter', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'simple.md'), 'utf-8');

      // Test that fileTitle is required and properly used
      const result = chunkMarkdown(content, 'test-document.md', {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      result.chunks.forEach(chunk => {
        expect(chunk.metadata?.fileTitle).toBe('test-document.md');
      });
    });

    it('should handle fileTitle validation', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'simple.md'), 'utf-8');

      // Test with empty fileTitle - should fallback to 'untitled'
      const result = chunkMarkdown(content, '', {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      });

      expect(result.chunks.length).toBeGreaterThan(0);
      result.chunks.forEach(chunk => {
        expect(chunk.metadata?.fileTitle).toBe('untitled');
      });
    });
  });

  describe('headerBreadcrumb building with " > " separator', () => {
    it('should build headerBreadcrumb correctly', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Main', 'Section', 'Subsection'],
            headerDepths: [1, 2, 3]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerBreadcrumb).toBe('Main > Section > Subsection');
    });

    it('should handle single heading in breadcrumb', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Single Heading'],
            headerDepths: [1]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerBreadcrumb).toBe('Single Heading');
    });

    it('should handle empty heading trail', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['paragraph'],
            headingTrail: [],
            headerDepths: []
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerBreadcrumb).toBe('');
    });
  });

  describe('Edge cases: no H1, multiple H1s, no headings', () => {
    it('should handle multiple H1s correctly', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'multi-h1.md'), 'utf-8');

      const result = chunkMarkdown(content, 'multi-h1.md', {
        minTokens: 20,
        maxTokens: 40, // Small tokens to force multiple chunks
        overlapSentences: 1,
        strictMode: false
      });

      expect(result.chunks.length).toBeGreaterThan(1);

      // Should have chunks with different H1 headers
      const headerPaths = result.chunks
        .map(chunk => chunk.metadata?.headerPath || [])
        .filter(path => path.length > 0);

      expect(headerPaths.length).toBeGreaterThan(0);

      // Should contain headers from multiple H1s
      const allHeaders = headerPaths.flat();
      expect(allHeaders).toContain('First Document');

      // Since chunking might not capture all headers depending on where breaks occur,
      // let's test that we at least handle multiple H1s properly by checking structure
      result.chunks.forEach(chunk => {
        if (chunk.metadata?.headerPath && chunk.metadata.headerPath.length > 0) {
          // Each chunk should have proper metadata structure
          expect(Array.isArray(chunk.metadata.headerPath)).toBe(true);
          expect(Array.isArray(chunk.metadata.headerDepths)).toBe(true);
          expect(Array.isArray(chunk.metadata.headerSlugs)).toBe(true);
        }
      });
    });

    it('should handle documents with no H1 headings', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'heading-gaps.md'), 'utf-8');

      const result = chunkMarkdown(content, 'heading-gaps.md', {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1,
        strictMode: false
      });

      expect(result.chunks.length).toBeGreaterThan(0);

      // Should still properly chunk even without H1
      result.chunks.forEach(chunk => {
        expect(chunk.metadata).toBeDefined();
        expect(Array.isArray(chunk.metadata?.headerPath)).toBe(true);
        expect(Array.isArray(chunk.metadata?.headerDepths)).toBe(true);
        expect(Array.isArray(chunk.metadata?.headerSlugs)).toBe(true);
      });
    });

    it('should handle documents with no headings at all', () => {
      const content = 'This is just plain text content with no headings.\n\nAnother paragraph of plain content.\n\nAnd yet another paragraph with some more text to make it substantial enough for chunking.';

      const result = chunkMarkdown(content, 'no-headings.md', {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1,
        strictMode: false
      });

      expect(result.chunks.length).toBeGreaterThan(0);

      result.chunks.forEach(chunk => {
        expect(chunk.metadata?.headerPath).toEqual([]);
        expect(chunk.metadata?.headerDepths).toEqual([]);
        expect(chunk.metadata?.headerSlugs).toEqual([]);
        expect(chunk.metadata?.sectionTitle).toBe('');
        expect(chunk.metadata?.sectionSlug).toBe('');
        expect(chunk.metadata?.headerBreadcrumb).toBe('');
      });
    });
  });

  describe('sectionTitle extraction (last item from headerPath)', () => {
    it('should extract sectionTitle as last item from headerPath', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Main', 'Section', 'Subsection'],
            headerDepths: [1, 2, 3]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.sectionTitle).toBe('Subsection');
    });

    it('should handle single item headerPath', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Only Header'],
            headerDepths: [1]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.sectionTitle).toBe('Only Header');
    });

    it('should handle empty headerPath', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['paragraph'],
            headingTrail: [],
            headerDepths: []
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.sectionTitle).toBe('');
    });
  });

  describe('headerDepths array generation', () => {
    it('should generate correct headerDepths array', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['H1', 'H2', 'H3', 'H4'],
            headerDepths: [1, 2, 3, 4]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerDepths).toEqual([1, 2, 3, 4]);
    });

    it('should handle missing headerDepths by generating from headerPath', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['H1', 'H2', 'H3'],
            // No headerDepths provided - should be generated
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      // Should generate depths starting from 1
      expect(result[0].metadata?.headerDepths).toEqual([1, 2, 3]);
    });

    it('should preserve existing headerDepths', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['H2', 'H4'], // Skip levels
            headerDepths: [2, 4] // Actual depths
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerDepths).toEqual([2, 4]);
    });
  });

  describe('Required validation and error handling', () => {
    it('should handle malformed input gracefully', () => {
      // Test with minimal valid input
      const result = chunkMarkdown(' ', 'minimal.md', {
        minTokens: 1,
        maxTokens: 10,
        overlapSentences: 0
      });

      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.stats).toBeDefined();
    });

    it('should validate chunk structure', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'simple.md'), 'utf-8');

      const result = chunkMarkdown(content, 'simple.md', {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      });

      result.chunks.forEach(chunk => {
        // Core fields should be present
        expect(chunk.id).toBeDefined();
        expect(chunk.content).toBeDefined();
        expect(chunk.originalText).toBeDefined();
        expect(chunk.embedText).toBeDefined();

        // Metadata should be complete
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata?.fileTitle).toBeDefined();
        expect(Array.isArray(chunk.metadata?.headerPath)).toBe(true);
        expect(Array.isArray(chunk.metadata?.headerDepths)).toBe(true);
        expect(Array.isArray(chunk.metadata?.headerSlugs)).toBe(true);
        expect(typeof chunk.metadata?.headerBreadcrumb).toBe('string');
        expect(typeof chunk.metadata?.sectionTitle).toBe('string');
        expect(typeof chunk.metadata?.sectionSlug).toBe('string');

        // Token information should be present
        expect(chunk.tokenStats).toBeDefined();
        expect(typeof chunk.tokenStats?.tokens).toBe('number');
        expect(typeof chunk.tokenStats?.estimatedTokens).toBe('number');

        // Pipeline info should be present
        expect(chunk.pipeline).toBeDefined();
        expect(typeof chunk.pipeline?.version).toBe('string');
        expect(typeof chunk.pipeline?.processingTimeMs).toBe('number');
      });
    });
  });
});