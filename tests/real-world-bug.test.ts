import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { chunkMarkdown } from '../lib/index';
import { ChunkOptions } from '../lib/types';

describe('Real World maxTokens Bug', () => {
  it('should reproduce the actual maxTokens violation with docs/overlap.md', () => {
    const content = readFileSync(join(__dirname, '..', 'docs', 'overlap.md'), 'utf-8');

    const options: ChunkOptions = {
      maxTokens: 512,
      minTokens: 64,
      targetTokens: 400,
      overlapSentences: 2,
      strictMode: false,  // Use lenient mode to see actual results
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(content, 'overlap.md', options);
    const chunks = result.chunks;

    console.log('\nDEBUG: docs/overlap.md chunking results:');
    console.log(`  Total chunks: ${chunks.length}`);
    console.log(`  Content length: ${content.length} characters`);

    chunks.forEach((chunk, index) => {
      console.log(`  Chunk ${index + 1}: ${chunk.tokens} tokens (maxTokens: ${options.maxTokens})`);
      console.log(`    Section: ${chunk.metadata?.sectionTitle || 'N/A'}`);
      console.log(`    Content length: ${(chunk.content || '').length} chars`);
      console.log(`    Preview: "${(chunk.content || '').substring(0, 100).replace(/\n/g, ' ')}..."`);
    });

    // Find violations
    const violations = chunks.filter(chunk => (chunk.tokens || 0) > options.maxTokens);

    if (violations.length > 0) {
      console.log(`\nBUG REPRODUCED: ${violations.length} chunks exceed maxTokens!`);
      violations.forEach((chunk, index) => {
        console.log(`  Violation ${index + 1}:`);
        console.log(`    Tokens: ${chunk.tokens} (exceeds ${options.maxTokens})`);
        console.log(`    Section: ${chunk.metadata?.sectionTitle}`);
        console.log(`    Content first 200 chars: "${(chunk.content || '').substring(0, 200)}..."`);
      });
    }

    // This test is expected to fail initially, demonstrating the bug
    chunks.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `docs/overlap.md chunk ${index + 1} exceeds maxTokens: ${chunk.tokens} > ${options.maxTokens}`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });

  it('should work correctly with the skeleton-250.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures', 'skeleton-250.md'), 'utf-8');

    const options: ChunkOptions = {
      maxTokens: 512,
      minTokens: 64,
      targetTokens: 400,
      overlapSentences: 2,
      strictMode: false,
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(content, 'skeleton-250.md', options);
    const chunks = result.chunks;

    console.log('\nDEBUG: skeleton-250.md chunking results:');
    chunks.forEach((chunk, index) => {
      console.log(`  Chunk ${index + 1}: ${chunk.tokens} tokens (maxTokens: ${options.maxTokens})`);
    });

    // This should pass if our fix is working for most cases
    chunks.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `skeleton-250.md chunk ${index + 1} exceeds maxTokens`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });
});