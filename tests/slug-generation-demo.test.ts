import { describe, it, expect, beforeEach } from 'vitest';
import { chunkMarkdown } from '../lib/index';
import { attachMetadata, resetSlugger } from '../lib/metadata';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Slug Generation Demo', () => {
  beforeEach(() => {
    resetSlugger();
  });

  describe('Unit Tests - Direct metadata testing', () => {
    it('should generate basic slugs correctly', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Hello World'],
            headerDepths: [1]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerSlugs).toEqual(['hello-world']);
      expect(result[0].metadata?.sectionSlug).toBe('hello-world');
    });

    it('should handle special characters and markdown formatting', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['**Bold** and `Code` [Link](url)'],
            headerDepths: [1]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerSlugs).toEqual(['bold-and-code-link']);
      expect(result[0].metadata?.sectionSlug).toBe('bold-and-code-link');
    });

    it('should handle nested headings correctly', () => {
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

      expect(result[0].metadata?.headerSlugs).toEqual(['main', 'section', 'subsection']);
      expect(result[0].metadata?.sectionSlug).toBe('subsection');
    });

    it('should handle duplicate headings with proper slug reuse', () => {
      const chunks = [
        {
          content: 'Test content 1',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Overview'],
            headerDepths: [1]
          }
        },
        {
          content: 'Test content 2',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Overview'], // Same heading, should reuse slug
            headerDepths: [1]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      // Both should get the same slug since they have identical text
      expect(result[0].metadata?.headerSlugs).toEqual(['overview']);
      expect(result[1].metadata?.headerSlugs).toEqual(['overview']);
    });

    it('should reuse slugs for same headings in different chunks', () => {
      const chunks = [
        {
          content: 'Test content 1',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Main'],
            headerDepths: [1]
          }
        },
        {
          content: 'Test content 2',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: ['Main', 'Section'], // Main should reuse slug
            headerDepths: [1, 2]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerSlugs).toEqual(['main']);
      expect(result[1].metadata?.headerSlugs).toEqual(['main', 'section']);
      // Both chunks should have 'main' with the same slug
    });
  });

  describe('Integration Tests - Using simple fixtures', () => {
    it('should generate slugs for a real document', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'simple.md'), 'utf-8');

      const result = chunkMarkdown(content, 'simple.md', {
        minTokens: 30,
        maxTokens: 60, // Force multiple chunks
        overlapSentences: 1,
        breadcrumbMode: 'conditional',
        strictMode: false
      });

      expect(result.chunks.length).toBeGreaterThan(1);

      // Check that we have slug fields in all chunks
      result.chunks.forEach(chunk => {
        expect(chunk.metadata).toHaveProperty('headerSlugs');
        expect(chunk.metadata).toHaveProperty('sectionSlug');
        expect(Array.isArray(chunk.metadata?.headerSlugs)).toBe(true);
        expect(typeof chunk.metadata?.sectionSlug).toBe('string');
      });

      // Check that we have expected slugs
      const allSlugs = result.chunks.flatMap(c => c.metadata?.headerSlugs || []);
      expect(allSlugs).toContain('simple-document');
      expect(allSlugs).toContain('heading-two');

      // Check sectionSlug is last in headerSlugs
      result.chunks.forEach(chunk => {
        const headerSlugs = chunk.metadata?.headerSlugs || [];
        const sectionSlug = chunk.metadata?.sectionSlug || '';

        if (headerSlugs.length > 0) {
          expect(sectionSlug).toBe(headerSlugs[headerSlugs.length - 1]);
        } else {
          expect(sectionSlug).toBe('');
        }
      });
    });

    it('should demonstrate slug functionality with heading hierarchy', () => {
      const content = readFileSync(join(__dirname, 'fixtures', 'headings.md'), 'utf-8');

      const result = chunkMarkdown(content, 'headings.md', {
        minTokens: 20,
        maxTokens: 50, // Very small to force many chunks
        overlapSentences: 1,
        breadcrumbMode: 'conditional',
        strictMode: false
      });

      expect(result.chunks.length).toBeGreaterThan(1);

      // Check basic slug generation
      const allSlugs = result.chunks.flatMap(c => c.metadata?.headerSlugs || []);
      expect(allSlugs).toContain('main-title');

      // Log the actual results for inspection
      console.log('\\nSlug generation results:');
      result.chunks.forEach((chunk, i) => {
        console.log(`Chunk ${i}: ${JSON.stringify(chunk.metadata?.headerSlugs)} -> "${chunk.metadata?.sectionSlug}"`);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty headings gracefully', () => {
      const chunks = [
        {
          content: 'Test content',
          tokens: 50,
          metadata: {
            nodeCount: 1,
            types: ['heading'],
            headingTrail: [''],
            headerDepths: [1]
          }
        }
      ];

      const result = attachMetadata(chunks, {
        minTokens: 30,
        maxTokens: 100,
        overlapSentences: 1
      }, 'test.md');

      expect(result[0].metadata?.headerSlugs).toEqual(['']);
      expect(result[0].metadata?.sectionSlug).toBe('');
    });

    it('should handle chunks with no headings', () => {
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

      expect(result[0].metadata?.headerSlugs).toEqual([]);
      expect(result[0].metadata?.sectionSlug).toBe('');
    });
  });
});