import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { generateEmbedText, addEmbedText } from '../lib/embed-text';
import { chunkMarkdown } from '../lib/index';
import type { Chunk } from '../lib/types';

describe('embedText generation', () => {
  const createTestChunk = (originalText: string, overrides: Partial<Chunk> = {}): Chunk => ({
    originalText,
    metadata: {
      fileTitle: 'Test Document',
      headerPath: ['Main Section', 'Subsection'],
      headerBreadcrumb: 'Main Section > Subsection',
      sectionTitle: 'Subsection',
      nodeTypes: ['paragraph'],
      contentType: 'doc',
      sourceFile: 'test.md',
      headerDepths: [1, 2],
      headerSlugs: ['main-section', 'subsection'],
      sectionSlug: 'subsection',
      processedAt: new Date().toISOString()
    },
    tokenStats: {
      tokens: 100,
      estimatedTokens: 100
    },
    ...overrides
  });

  describe('breadcrumb mode: none', () => {
    it('should never prepend any breadcrumb context', () => {
      const chunk = createTestChunk('Some content here.');
      const result = generateEmbedText(chunk, 'none');

      expect(result).toBe('Some content here.');
      expect(result).not.toContain('Test Document');
      expect(result).not.toContain('Main Section');
    });

    it('should return original text even for short chunks', () => {
      const chunk = createTestChunk('Short.', {
        tokenStats: { tokens: 5, estimatedTokens: 5 }
      });
      const result = generateEmbedText(chunk, 'none', 200);

      expect(result).toBe('Short.');
    });

    it('should return original text even for code-only chunks', () => {
      const chunk = createTestChunk('```javascript\nconst x = 1;\n```', {
        metadata: {
          ...createTestChunk('').metadata!,
          nodeTypes: ['code']
        }
      });
      const result = generateEmbedText(chunk, 'none');

      expect(result).toBe('```javascript\nconst x = 1;\n```');
    });
  });

  describe('breadcrumb mode: always', () => {
    it('should always prepend full breadcrumb', () => {
      const chunk = createTestChunk('Regular content.');
      const result = generateEmbedText(chunk, 'always');

      expect(result).toBe('Test Document > Main Section > Subsection\n\nRegular content.');
    });

    it('should prepend even for long chunks', () => {
      const chunk = createTestChunk('Very long content that exceeds token limits.', {
        tokenStats: { tokens: 500, estimatedTokens: 500 }
      });
      const result = generateEmbedText(chunk, 'always', 200);

      expect(result).toBe('Test Document > Main Section > Subsection\n\nVery long content that exceeds token limits.');
    });

    it('should handle case where fileTitle equals first header', () => {
      const chunk = createTestChunk('Content here.', {
        metadata: {
          ...createTestChunk('').metadata!,
          fileTitle: 'Main Section', // Same as first header
          headerPath: ['Main Section', 'Subsection'],
          headerBreadcrumb: 'Main Section > Subsection'
        }
      });
      const result = generateEmbedText(chunk, 'always');

      expect(result).toBe('Main Section > Subsection\n\nContent here.');
      expect(result).not.toContain('Main Section > Main Section');
    });

    it('should not prepend if chunk already starts with exact heading', () => {
      const chunk = createTestChunk('## Subsection\n\nContent after heading.', {
        metadata: {
          ...createTestChunk('').metadata!,
          sectionTitle: 'Subsection'
        }
      });
      const result = generateEmbedText(chunk, 'always');

      expect(result).toBe('## Subsection\n\nContent after heading.');
    });

    it('should truncate very long breadcrumbs', () => {
      const longPath = Array(10).fill('Very Long Section Name That Exceeds Limits');
      const chunk = createTestChunk('Content.', {
        metadata: {
          ...createTestChunk('').metadata!,
          fileTitle: 'Very Long Document Title',
          headerPath: longPath,
          headerBreadcrumb: longPath.join(' > ')
        }
      });
      const result = generateEmbedText(chunk, 'always');

      expect(result.length).toBeLessThan(200); // Should be truncated
      expect(result).toContain('…'); // Should contain ellipsis
      expect(result).toContain('\n\nContent.'); // Should still have content
    });
  });

  describe('breadcrumb mode: conditional (default)', () => {
    it('should prepend for short chunks', () => {
      const chunk = createTestChunk('Short content.', {
        tokenStats: { tokens: 50, estimatedTokens: 50 }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      expect(result).toBe('Test Document > Main Section > Subsection\n\nShort content.');
    });

    it('should not prepend for long chunks with good context', () => {
      const chunk = createTestChunk('This is a long paragraph with plenty of context and information that makes it clear what section it belongs to.', {
        tokenStats: { tokens: 300, estimatedTokens: 300 },
        metadata: {
          ...createTestChunk('').metadata!,
          nodeTypes: ['paragraph'] // Regular paragraph content
        }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      // Should only prepend fileTitle since fileTitle !== headerPath[0]
      expect(result).toBe('Test Document\n\nThis is a long paragraph with plenty of context and information that makes it clear what section it belongs to.');
    });

    it('should prepend for chunks starting with headings (new sections)', () => {
      const chunk = createTestChunk('## New Section\n\nThis starts a new section.', {
        tokenStats: { tokens: 300, estimatedTokens: 300 }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      expect(result).toBe('Test Document > Main Section > Subsection\n\n## New Section\n\nThis starts a new section.');
    });

    it('should prepend for context-less chunks (code only)', () => {
      const chunk = createTestChunk('```javascript\nfunction hello() {\n  console.log("world");\n}\n```', {
        tokenStats: { tokens: 300, estimatedTokens: 300 },
        metadata: {
          ...createTestChunk('').metadata!,
          nodeTypes: ['code'] // Code-only chunk
        }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      expect(result).toBe('Test Document > Main Section > Subsection\n\n```javascript\nfunction hello() {\n  console.log("world");\n}\n```');
    });

    it('should prepend for context-less chunks (table only)', () => {
      const chunk = createTestChunk('| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |', {
        tokenStats: { tokens: 300, estimatedTokens: 300 },
        metadata: {
          ...createTestChunk('').metadata!,
          nodeTypes: ['table'] // Table-only chunk
        }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      expect(result).toBe('Test Document > Main Section > Subsection\n\n| Column 1 | Column 2 |\n|----------|----------|\n| Data 1   | Data 2   |');
    });

    it('should prepend for context-less chunks (list only)', () => {
      const chunk = createTestChunk('- Item 1\n- Item 2\n- Item 3', {
        tokenStats: { tokens: 300, estimatedTokens: 300 },
        metadata: {
          ...createTestChunk('').metadata!,
          nodeTypes: ['list-item'] // List-only chunk
        }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      expect(result).toBe('Test Document > Main Section > Subsection\n\n- Item 1\n- Item 2\n- Item 3');
    });

    it('should handle fileTitle same as first header correctly', () => {
      const chunk = createTestChunk('Long content that exceeds minimum tokens.', {
        tokenStats: { tokens: 300, estimatedTokens: 300 },
        metadata: {
          ...createTestChunk('').metadata!,
          fileTitle: 'Main Section', // Same as first header
          headerPath: ['Main Section', 'Subsection'],
          headerBreadcrumb: 'Main Section > Subsection'
        }
      });
      const result = generateEmbedText(chunk, 'conditional', 200);

      // Since fileTitle === headerPath[0], should not prepend anything for regular paragraph
      expect(result).toBe('Long content that exceeds minimum tokens.');
    });
  });

  describe('addEmbedText batch processing', () => {
    it('should process multiple chunks with different modes', () => {
      const chunks: Chunk[] = [
        createTestChunk('First chunk.', { tokenStats: { tokens: 50, estimatedTokens: 50 } }),
        createTestChunk('Second chunk.', { tokenStats: { tokens: 300, estimatedTokens: 300 } }),
        createTestChunk('Third chunk.', { tokenStats: { tokens: 150, estimatedTokens: 150 } })
      ];

      const result = addEmbedText(chunks, 'conditional', 200);

      expect(result).toHaveLength(3);
      expect(result[0].embedText).toContain('Test Document > Main Section > Subsection'); // Short chunk
      expect(result[1].embedText).toContain('Test Document\n\nSecond chunk.'); // Long chunk, fileTitle only
      expect(result[2].embedText).toContain('Test Document > Main Section > Subsection'); // Short chunk
    });
  });

  describe('integration with fixture documents', () => {
    it('should work with simple.md fixture', () => {
      const content = readFileSync(join(__dirname, 'fixtures/simple.md'), 'utf-8');
      const { chunks } = chunkMarkdown(content, 'Simple Document', {
        minTokens: 64,
        maxTokens: 512,
        overlapSentences: 2,
        breadcrumbMode: 'conditional'
      });

      expect(chunks.length).toBeGreaterThan(0);

      // All chunks should have embedText
      chunks.forEach(chunk => {
        expect(chunk.embedText).toBeDefined();
        expect(typeof chunk.embedText).toBe('string');
        expect(chunk.embedText!.length).toBeGreaterThan(0);
      });

      // Find a chunk with heading and verify breadcrumb logic
      const headingChunk = chunks.find(chunk =>
        chunk.originalText?.includes('# Simple Document') ||
        chunk.originalText?.includes('## ') ||
        chunk.originalText?.includes('### ')
      );

      if (headingChunk) {
        // Chunks with headings should get breadcrumbs (new sections)
        const shouldHaveBreadcrumb = headingChunk.embedText!.includes('Simple Document');
        const hasHeading = headingChunk.originalText!.match(/^#+\s/m);

        if (hasHeading) {
          expect(shouldHaveBreadcrumb).toBe(true);
        }
      }
    });

    it('should work with headings.md fixture', () => {
      const content = readFileSync(join(__dirname, 'fixtures/headings.md'), 'utf-8');
      const { chunks } = chunkMarkdown(content, 'Headings Test Document', {
        minTokens: 32, // Lower minTokens to avoid strict mode failures
        maxTokens: 512,
        overlapSentences: 2,
        breadcrumbMode: 'always',
        strictMode: false // Use lenient mode for this test
      });

      expect(chunks.length).toBeGreaterThan(0);

      // With 'always' mode, most chunks should have breadcrumbs
      const chunksWithBreadcrumbs = chunks.filter(chunk =>
        chunk.embedText!.includes('Headings Test Document')
      );

      expect(chunksWithBreadcrumbs.length).toBeGreaterThan(0);

      // Verify embedText is different from originalText for chunks with breadcrumbs
      chunksWithBreadcrumbs.forEach(chunk => {
        expect(chunk.embedText).not.toBe(chunk.originalText);
        expect(chunk.embedText!.length).toBeGreaterThan(chunk.originalText!.length);
      });
    });

    it('should work with code-heavy.md fixture', () => {
      const content = readFileSync(join(__dirname, 'fixtures/code-heavy.md'), 'utf-8');
      const { chunks } = chunkMarkdown(content, 'Code Documentation', {
        minTokens: 32,
        maxTokens: 512,
        overlapSentences: 2,
        breadcrumbMode: 'conditional',
        strictMode: false
      });

      expect(chunks.length).toBeGreaterThan(0);

      // Find chunks containing code
      const codeChunks = chunks.filter(chunk =>
        chunk.metadata?.nodeTypes?.includes('code') ||
        chunk.originalText?.includes('```') ||
        chunk.originalText?.includes('function') ||
        chunk.originalText?.includes('const ') ||
        chunk.originalText?.includes('import ')
      );

      if (codeChunks.length > 0) {
        // Verify that some chunks have breadcrumbs applied
        const chunksWithBreadcrumbs = codeChunks.filter(chunk =>
          chunk.embedText?.includes('Code Documentation')
        );

        expect(chunksWithBreadcrumbs.length).toBeGreaterThan(0);
      } else {
        // If no code chunks found, at least verify all chunks have embedText
        chunks.forEach(chunk => {
          expect(chunk.embedText).toBeDefined();
          expect(typeof chunk.embedText).toBe('string');
        });
      }
    });

    it('should respect none mode with fixtures', () => {
      const content = readFileSync(join(__dirname, 'fixtures/simple.md'), 'utf-8');
      const { chunks } = chunkMarkdown(content, 'Test Document', {
        minTokens: 32,
        maxTokens: 512,
        overlapSentences: 2,
        breadcrumbMode: 'none',
        strictMode: false
      });

      // With 'none' mode, embedText should equal originalText
      chunks.forEach(chunk => {
        expect(chunk.embedText).toBe(chunk.originalText);
      });
    });
  });
});