import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { chunkMarkdown } from '../lib/index';
import { ChunkOptions } from '../lib/types';

describe('Small Chunk Merging', () => {
  it('should merge consecutive small chunks to reach target size', () => {
    // Use our custom test fixture designed for this scenario
    const content = readFileSync(join(__dirname, 'fixtures', 'target-merging-test.md'), 'utf-8');

    const options: ChunkOptions = {
      maxTokens: 512,
      minTokens: 32,
      targetTokens: 150,  // Target size - should merge multiple small sections
      overlapSentences: 1,
      strictMode: true,
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(content, 'target-merging-test.md', options);
    const chunks = result.chunks;

    // Check that we don't have multiple consecutive small chunks
    // when they could be merged to get closer to target size
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i];
      const nextChunk = chunks[i + 1];

      const currentTokens = currentChunk.tokens || 0;
      const nextTokens = nextChunk.tokens || 0;
      const combinedTokens = currentTokens + nextTokens;
      const targetTokens = options.targetTokens || 400;

      // If both chunks are significantly below target AND
      // combining them would still be under maxTokens AND
      // combining them would be closer to target than either alone
      if (currentTokens < targetTokens * 0.7 &&
          nextTokens < targetTokens * 0.7 &&
          combinedTokens <= (options.maxTokens || 512) &&
          Math.abs(combinedTokens - targetTokens) < Math.abs(currentTokens - targetTokens)) {

        expect.fail(
          `Chunks ${i + 1} (${currentTokens} tokens) and ${i + 2} (${nextTokens} tokens) should be merged. ` +
          `Combined: ${combinedTokens} tokens would be closer to target ${targetTokens} than either alone. ` +
          `Current sections: "${currentChunk.metadata?.sectionTitle}" and "${nextChunk.metadata?.sectionTitle}"`
        );
      }
    }
  });

  it('should prioritize reaching target size over strict section boundaries for small chunks', () => {
    // Use small-nodes.md fixture which has 5 small sections
    const content = readFileSync(join(__dirname, 'fixtures', 'small-nodes.md'), 'utf-8');

    const options: ChunkOptions = {
      maxTokens: 512,
      minTokens: 64,
      targetTokens: 150,  // Lower target for this test - should merge multiple sections
      overlapSentences: 1,
      strictMode: true,
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(content, 'small-nodes.md', options);
    const chunks = result.chunks;

    // Should have fewer chunks than sections because small sections get merged
    // small-nodes.md has 5 sections (Node One through Node Five)
    const expectedSections = 5;
    expect(chunks.length).toBeLessThan(expectedSections);

    // For very small documents that fit in one chunk, the behavior is correct
    // Most chunks should be reasonably sized (not tiny)
    const reasonablySizedChunks = chunks.filter(chunk =>
      (chunk.tokens || 0) >= 30  // At least 30 tokens
    );
    expect(reasonablySizedChunks.length).toBeGreaterThan(0);

    // Should not have many tiny chunks
    const tinyChunks = chunks.filter(chunk => (chunk.tokens || 0) < 50);
    expect(tinyChunks.length).toBeLessThanOrEqual(1); // At most one tiny chunk allowed
  });

  it('should not merge chunks if it would exceed maxTokens', () => {
    // Use large-nodes.md fixture which has substantial content
    const content = readFileSync(join(__dirname, 'fixtures', 'large-nodes.md'), 'utf-8');

    const options: ChunkOptions = {
      maxTokens: 200,  // Small max to test boundary
      minTokens: 32,
      targetTokens: 150,
      overlapSentences: 1,
      strictMode: true,
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(content, 'large-nodes.md', options);
    const chunks = result.chunks;

    // All chunks should respect maxTokens
    chunks.forEach((chunk) => {
      expect(chunk.tokens || 0).toBeLessThanOrEqual(options.maxTokens || 200);
    });
  });

  it('should optimize chunk sizes toward target in realistic multi-chunk documents', () => {
    // Use svelte-250.md - a large fixture with varied section sizes
    const content = readFileSync(join(__dirname, 'fixtures', 'svelte-250.md'), 'utf-8');

    const options: ChunkOptions = {
      maxTokens: 600,  // Higher max to avoid validation issues during testing
      minTokens: 64,
      targetTokens: 400,  // Target size chunks should aim for
      overlapSentences: 2,
      strictMode: false,  // Use lenient mode to avoid validation errors
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(content, 'svelte-250.md', options);
    const chunks = result.chunks;

    // Should create multiple chunks (it's a large document)
    expect(chunks.length).toBeGreaterThan(2);

    // Most chunks should be reasonably close to target
    const chunksNearTarget = chunks.filter(chunk => {
      const tokens = chunk.tokens || 0;
      const target = options.targetTokens || 400;
      // Consider "near target" as 70% to 130% of target
      return tokens >= target * 0.7 && tokens <= target * 1.3;
    });

    // At least 60% of chunks should be near target
    expect(chunksNearTarget.length).toBeGreaterThanOrEqual(Math.floor(chunks.length * 0.6));

    // Should not have many very small chunks
    const verySmallChunks = chunks.filter(chunk => (chunk.tokens || 0) < options.minTokens * 1.5);
    expect(verySmallChunks.length).toBeLessThanOrEqual(1);

    // All chunks should respect maxTokens hard limit
    chunks.forEach((chunk) => {
      expect(chunk.tokens || 0).toBeLessThanOrEqual(options.maxTokens || 600);
    });

    // Average chunk size should be closer to target than to minTokens
    const avgTokens = chunks.reduce((sum, chunk) => sum + (chunk.tokens || 0), 0) / chunks.length;
    const distanceToTarget = Math.abs(avgTokens - (options.targetTokens || 400));
    const distanceToMin = Math.abs(avgTokens - options.minTokens);
    expect(distanceToTarget).toBeLessThan(distanceToMin);
  });
});