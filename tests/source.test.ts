/**
 * source.test.ts
 *
 * Tests for source document initialization and metrics calculation.
 * Demonstrates expected behavior of calculateSourceMetrics and initializeSource.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  calculateSourceMetrics,
  estimateChunks,
  initializeSource
} from '../lib/source';
import { withDefaults } from '../lib/default-config';
// import type { ChunkOptions } from '../lib/types';

describe('Source Initialization', () => {
  // Load test fixtures
  const loadFixture = (filename: string): string => {
    return readFileSync(join(__dirname, 'fixtures', filename), 'utf-8');
  };

  const defaultOptions = withDefaults({});

  describe('calculateSourceMetrics', () => {
    it('should calculate metrics for a simple document', () => {
      const content = loadFixture('simple.md');
      const metrics = calculateSourceMetrics(content, defaultOptions);

      // Simple.md has ~458 characters
      expect(metrics.length).toBe(content.length);
      expect(metrics.length).toBe(458);

      // Should have a reasonable token count (roughly 1 token per 3-4 chars)
      expect(metrics.tokens).toBeGreaterThan(100);
      expect(metrics.tokens).toBeLessThan(200);

      // With default maxTokens of 512, should estimate 1 chunk
      expect(metrics.estimatedChunks).toBe(1);
    });

    it('should calculate metrics for a large document', () => {
      const content = loadFixture('skeleton-250.md');
      const metrics = calculateSourceMetrics(content, defaultOptions);

      // skeleton-250.md has ~8723 characters
      expect(metrics.length).toBe(content.length);
      expect(metrics.length).toBe(8723);

      // Should have a much higher token count
      expect(metrics.tokens).toBeGreaterThan(2000);

      // With default maxTokens of 512, should estimate multiple chunks
      expect(metrics.estimatedChunks).toBeGreaterThan(4);
    });

    it('should calculate metrics for mixed content', () => {
      const content = loadFixture('mixed-content.md');
      const metrics = calculateSourceMetrics(content, defaultOptions);

      // mixed-content.md has ~1306 characters
      expect(metrics.length).toBe(content.length);
      expect(metrics.length).toBe(1306);

      // Token count should be proportional
      expect(metrics.tokens).toBeGreaterThan(200);
      expect(metrics.tokens).toBeLessThan(400);
    });

    it('should handle empty content', () => {
      const content = '';
      const metrics = calculateSourceMetrics(content, defaultOptions);

      expect(metrics.length).toBe(0);
      expect(metrics.tokens).toBe(0);
      expect(metrics.estimatedChunks).toBe(1); // Minimum is 1
    });

    it('should use custom options for chunk estimation', () => {
      const content = loadFixture('large-nodes.md');

      // Test with smaller maxTokens
      const smallOptions = withDefaults({ maxTokens: 100 });
      const smallMetrics = calculateSourceMetrics(content, smallOptions);

      // Test with larger maxTokens
      const largeOptions = withDefaults({ maxTokens: 1000 });
      const largeMetrics = calculateSourceMetrics(content, largeOptions);

      // Same token count for both
      expect(smallMetrics.tokens).toBe(largeMetrics.tokens);

      // But different estimated chunks (or equal if both fit in maxTokens)
      expect(smallMetrics.estimatedChunks).toBeGreaterThanOrEqual(largeMetrics.estimatedChunks);
    });
  });

  describe('estimateChunks', () => {
    it('should return 1 for content that fits in maxTokens', () => {
      const options = withDefaults({ maxTokens: 500 });

      expect(estimateChunks(100, options)).toBe(1);
      expect(estimateChunks(499, options)).toBe(1);
      expect(estimateChunks(500, options)).toBe(1);
    });

    it('should use targetTokens when provided', () => {
      const options = withDefaults({
        maxTokens: 500,
        targetTokens: 200
      });

      // 600 tokens / 200 target = 3 chunks
      expect(estimateChunks(600, options)).toBe(3);

      // 199 tokens should still be 1 chunk (fits in maxTokens)
      expect(estimateChunks(199, options)).toBe(1);

      // 501 tokens should be 3 chunks (501 / 200 = 3)
      expect(estimateChunks(501, options)).toBe(3);
    });

    it('should default to 80% of maxTokens when targetTokens not provided', () => {
      const options = withDefaults({ maxTokens: 500 });
      // Default target = 500 * 0.8 = 400

      // 500 tokens fits in maxTokens, so 1 chunk
      expect(estimateChunks(500, options)).toBe(1);

      // 501 tokens exceeds maxTokens, use 80% rule (400 tokens)
      // 501 / 400 = 2 chunks
      expect(estimateChunks(501, options)).toBe(2);

      // 801 tokens / 400 = 3 chunks
      expect(estimateChunks(801, options)).toBe(3);
    });

    it('should always return at least 1 chunk', () => {
      const options = withDefaults({});

      expect(estimateChunks(0, options)).toBe(1);
      expect(estimateChunks(-100, options)).toBe(1);
    });
  });

  describe('initializeSource', () => {
    it('should create complete source data for a simple document', () => {
      const content = loadFixture('simple.md');
      const title = 'simple.md';
      const options = withDefaults({});

      const source = initializeSource(content, title, options);

      // Should have all required fields
      expect(source.content).toBe(content);
      expect(source.title).toBe(title);
      expect(source.length).toBe(content.length);
      expect(source.tokens).toBeGreaterThan(0);
      expect(source.estimatedChunks).toBeGreaterThan(0);
    });

    it('should create source data with code-heavy content', () => {
      const content = loadFixture('code-heavy.md');
      const title = 'code-heavy.md';
      const options = withDefaults({ maxTokens: 200 });

      const source = initializeSource(content, title, options);

      expect(source.content).toBe(content);
      expect(source.title).toBe(title);

      // Code typically has higher token density
      const tokenDensity = source.tokens / source.length;
      expect(tokenDensity).toBeGreaterThan(0.15); // Higher density for code
    });

    it('should handle documents with special characters', () => {
      const content = loadFixture('messy-content.md');
      const title = 'messy-content.md';
      const options = withDefaults({});

      const source = initializeSource(content, title, options);

      expect(source.content).toBe(content);
      expect(source.title).toBe(title);
      expect(source.length).toBe(content.length);
      expect(source.tokens).toBeGreaterThan(0);
    });

    it('should preserve title even when content is empty', () => {
      const content = '';
      const title = 'empty-file.md';
      const options = withDefaults({});

      const source = initializeSource(content, title, options);

      expect(source.content).toBe('');
      expect(source.title).toBe(title);
      expect(source.length).toBe(0);
      expect(source.tokens).toBe(0);
      expect(source.estimatedChunks).toBe(1); // Minimum
    });

    it('should respect different chunking options', () => {
      const content = loadFixture('multi-h1.md');
      const title = 'multi-h1.md';

      // Test with different configurations
      const smallChunks = initializeSource(
        content,
        title,
        withDefaults({ maxTokens: 100, targetTokens: 80 })
      );

      const largeChunks = initializeSource(
        content,
        title,
        withDefaults({ maxTokens: 1000, targetTokens: 800 })
      );

      // Same content and tokens
      expect(smallChunks.content).toBe(largeChunks.content);
      expect(smallChunks.tokens).toBe(largeChunks.tokens);

      // Different chunk estimates
      expect(smallChunks.estimatedChunks).toBeGreaterThan(largeChunks.estimatedChunks);
    });
  });

  describe('Source metrics documentation', () => {
    it('demonstrates token density patterns', () => {
      const fixtures = [
        { name: 'simple.md', expectedDensity: [0.15, 0.35] },
        { name: 'code-heavy.md', expectedDensity: [0.15, 0.4] },
        { name: 'mixed-content.md', expectedDensity: [0.15, 0.35] },
        { name: 'heading-gaps.md', expectedDensity: [0.15, 0.35] }
      ];

      fixtures.forEach(({ name, expectedDensity }) => {
        const content = loadFixture(name);
        const metrics = calculateSourceMetrics(content, defaultOptions);
        const density = metrics.tokens / metrics.length;

        expect(density).toBeGreaterThanOrEqual(expectedDensity[0]);
        expect(density).toBeLessThanOrEqual(expectedDensity[1]);
      });
    });

    it('demonstrates chunk estimation accuracy', () => {
      // This test documents how chunk estimation works
      const content = loadFixture('large-nodes.md');
      const options = withDefaults({ maxTokens: 512, targetTokens: 400 });

      const metrics = calculateSourceMetrics(content, options);

      // The estimation formula:
      // - If tokens <= maxTokens: 1 chunk
      // - Otherwise: ceil(tokens / targetTokens)
      const expectedChunks = Math.ceil(metrics.tokens / 400);

      expect(metrics.estimatedChunks).toBe(expectedChunks);
    });

    it('demonstrates the relationship between options and metrics', () => {
      const content = loadFixture('skeleton-250.md');

      // Document how different options affect metrics
      const configs = [
        { maxTokens: 256, minTokens: 64, targetTokens: 200 },
        { maxTokens: 512, minTokens: 128, targetTokens: 400 },
        { maxTokens: 1024, minTokens: 256, targetTokens: 800 }
      ];

      const results = configs.map(config => {
        const options = withDefaults(config);
        const metrics = calculateSourceMetrics(content, options);
        return {
          config,
          tokens: metrics.tokens,
          estimatedChunks: metrics.estimatedChunks,
          avgTokensPerChunk: Math.floor(metrics.tokens / metrics.estimatedChunks)
        };
      });

      // Verify that larger maxTokens lead to fewer chunks
      expect(results[0].estimatedChunks).toBeGreaterThan(results[1].estimatedChunks);
      expect(results[1].estimatedChunks).toBeGreaterThanOrEqual(results[2].estimatedChunks);

      // Document that average tokens per chunk approaches targetTokens
      results.forEach(result => {
        const targetTokens = result.config.targetTokens!;
        const avgTokens = result.avgTokensPerChunk;

        // Average should be close to target (within reasonable variance)
        expect(avgTokens).toBeLessThanOrEqual(targetTokens * 1.2);
      });
    });
  });
});