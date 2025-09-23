import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '../lib/index';
import { packNodes } from '../lib/packer';
import { parseMarkdown } from '../lib/parse-markdown';
import { flattenAst } from '../lib/flatten-ast';

describe('Small Chunk Prevention', () => {
  describe('Single-chunk documents (should allow small chunks)', () => {
    it('should allow small chunks when entire document fits in one chunk', () => {
      const smallDoc = `# Small Document

This is a very small document with minimal content.`;

      const { chunks } = chunkMarkdown(smallDoc, 'Small Doc', {
        minTokens: 64,
        maxTokens: 512,
        overlapSentences: 2,
        strictMode: false
      });

      expect(chunks).toHaveLength(1);

      const tokens = chunks[0].tokenStats?.tokens || chunks[0].tokens || 0;
      expect(tokens).toBeLessThan(64); // Should be small but allowed
      expect(chunks[0].originalText).toContain('Small Document');
    });

    it('should allow very small single-chunk documents', () => {
      const tinyDoc = `# Tiny

Just a few words.`;

      const { chunks } = chunkMarkdown(tinyDoc, 'Tiny Doc', {
        minTokens: 100,
        maxTokens: 512,
        overlapSentences: 1,
        strictMode: false
      });

      expect(chunks).toHaveLength(1);

      const tokens = chunks[0].tokenStats?.tokens || chunks[0].tokens || 0;
      expect(tokens).toBeLessThan(100); // Should be small but allowed
    });

    it('should handle single-chunk with mixed content types', () => {
      const mixedDoc = `# Code Example

\`\`\`javascript
const x = 1;
\`\`\`

- Item 1
- Item 2`;

      const { chunks } = chunkMarkdown(mixedDoc, 'Mixed Doc', {
        minTokens: 64,
        maxTokens: 512,
        overlapSentences: 1,
        strictMode: false
      });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata?.nodeTypes).toContain('code');
      expect(chunks[0].metadata?.nodeTypes).toContain('list-item');
    });
  });

  describe('Multi-chunk documents (should prevent small chunks)', () => {
    it('should not create small chunks in multi-chunk documents', () => {
      const multiDoc = `# Large Document

This is a much larger document that will definitely span multiple chunks because it has a lot of content.

## Section 1

This section has substantial content that should easily meet the minimum token requirements. We're adding more text here to ensure this chunk is large enough to not be considered small. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Section 2

This is another substantial section with plenty of content. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Section 3

And here's the final section with even more content to ensure we get multiple chunks. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.`;

      const { chunks } = chunkMarkdown(multiDoc, 'Large Doc', {
        minTokens: 64,
        maxTokens: 200, // Small max to force multiple chunks
        overlapSentences: 1,
        strictMode: false
      });

      expect(chunks.length).toBeGreaterThan(1);

      // All chunks should meet minimum token requirements
      chunks.forEach((chunk, index) => {
        const tokens = chunk.tokenStats?.tokens || chunk.tokens || 0;
        expect(tokens).toBeGreaterThanOrEqual(64, `Chunk ${index} has ${tokens} tokens, below minimum`);
      });
    });

    it('should merge small final chunks with previous chunks', () => {
      const docWithSmallEnd = `# Document

This is a substantial first section that should meet the minimum token requirements. We're adding enough content here to make sure this forms a good-sized chunk that exceeds the minimum.

## Main Content

Here's the main bulk of content that should form another good-sized chunk. We're adding enough text here to exceed the minimum token requirements and create a substantial chunk.

Small end.`; // This would normally be tiny

      const { chunks } = chunkMarkdown(docWithSmallEnd, 'Test Doc', {
        minTokens: 64,
        maxTokens: 150, // Force splitting but prevent small chunks
        overlapSentences: 1,
        strictMode: false
      });

      // Should not have any chunks below minimum tokens
      chunks.forEach((chunk, index) => {
        const tokens = chunk.tokenStats?.tokens || chunk.tokens || 0;
        expect(tokens).toBeGreaterThanOrEqual(64, `Chunk ${index} has ${tokens} tokens, below minimum`);
      });

      // The last chunk should contain the small end content merged with previous content
      if (chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        expect(lastChunk.originalText).toContain('Small end');
      }
    });

    it('should handle complex document structures without creating small chunks', () => {
      const complexDoc = `# API Documentation

Welcome to our API documentation.

## Authentication

### API Keys

Use your API key for authentication.

\`\`\`javascript
const apiKey = 'your-key-here';
\`\`\`

### OAuth

For OAuth authentication:

1. Register your app
2. Get client credentials
3. Implement OAuth flow

## Endpoints

### Users

\`\`\`http
GET /api/users
\`\`\`

Returns user data.

### Posts

\`\`\`http
GET /api/posts
POST /api/posts
\`\`\`

Manage posts.

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /users   | 100/h |
| /posts   | 50/h  |

End.`; // Small ending

      const { chunks } = chunkMarkdown(complexDoc, 'API Docs', {
        minTokens: 64,
        maxTokens: 50, // Very small maxTokens to force multi-chunk splitting
        overlapSentences: 1,
        strictMode: false
      });

      // The algorithm should prevent small chunks, even if it means fewer chunks than expected
      expect(chunks.length).toBeGreaterThan(0);

      chunks.forEach((chunk, index) => {
        const tokens = chunk.tokenStats?.tokens || chunk.tokens || 0;
        expect(tokens).toBeGreaterThanOrEqual(64, `Chunk ${index} has ${tokens} tokens, below minimum`);
      });

      // Verify we have various content types (at least headings and code)
      const allNodeTypes = chunks.flatMap(chunk => chunk.metadata?.nodeTypes || []);
      expect(allNodeTypes).toContain('heading');
      expect(allNodeTypes).toContain('code');
    });
  });

  describe('Packer-level prevention', () => {
    it('should prevent small chunks at the packer level', () => {
      const testDoc = `# Test

Short paragraph.

## Section

Another short paragraph.

Tiny end.`;

      const ast = parseMarkdown(testDoc);
      const flatNodes = flattenAst(ast);

      // Test packer directly
      const chunks = packNodes(flatNodes, {
        minTokens: 50,
        maxTokens: 100,
        overlapSentences: 1
      });

      // If this creates multiple chunks, none should be below minTokens
      if (chunks.length > 1) {
        chunks.forEach((chunk, index) => {
          const tokens = chunk.tokens || 0;
          expect(tokens).toBeGreaterThanOrEqual(50, `Chunk ${index} from packer has ${tokens} tokens`);
        });
      }
    });

    it('should handle single-chunk detection correctly in packer', () => {
      const singleChunkDoc = `# Small

This is small content.`;

      const ast = parseMarkdown(singleChunkDoc);
      const flatNodes = flattenAst(ast);

      const chunks = packNodes(flatNodes, {
        minTokens: 50,
        maxTokens: 200,
        overlapSentences: 1
      });

      expect(chunks).toHaveLength(1);
      // Single chunk should be allowed even if small
      const tokens = chunks[0].tokens || 0;
      expect(tokens).toBeLessThan(50); // Verify it's actually small
    });
  });

  describe('Edge cases', () => {
    it('should handle documents with only headings', () => {
      const headingsOnly = `# Main

## Sub 1

### Sub Sub

## Sub 2`;

      const { chunks } = chunkMarkdown(headingsOnly, 'Headings Doc', {
        minTokens: 64,
        maxTokens: 512,
        overlapSentences: 1,
        strictMode: false
      });

      expect(chunks.length).toBeGreaterThan(0);

      // Should be treated as single-chunk (small) document
      if (chunks.length === 1) {
        expect(chunks[0].metadata?.nodeTypes).toContain('heading');
      }
    });

    it('should handle documents with only code blocks', () => {
      const codeOnly = `\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`

\`\`\`python
y = 2
print(y)
\`\`\``;

      const { chunks } = chunkMarkdown(codeOnly, 'Code Doc', {
        minTokens: 64,
        maxTokens: 512,
        overlapSentences: 1,
        strictMode: false
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.metadata?.nodeTypes).toContain('code');
      });
    });

    it('should handle empty or whitespace-only content gracefully', () => {
      const emptyDoc = `



`;

      const { chunks } = chunkMarkdown(emptyDoc, 'Empty Doc', {
        minTokens: 64,
        maxTokens: 512,
        overlapSentences: 1,
        strictMode: false
      });

      // Should either have no chunks or handle gracefully
      if (chunks.length > 0) {
        chunks.forEach(chunk => {
          expect(chunk.originalText?.trim().length).toBeGreaterThan(0);
        });
      }
    });
  });
});