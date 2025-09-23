import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { chunkMarkdown } from '../lib/index';
import { ChunkOptions } from '../lib/types';

const defaultOptions: ChunkOptions = {
  minTokens: 50,
  maxTokens: 300,
  targetTokens: 150,
  overlapSentences: 1,
  strictMode: false
};

const smallOptions: ChunkOptions = {
  minTokens: 20,
  maxTokens: 100,
  targetTokens: 50,
  overlapSentences: 1,
  strictMode: false
};

describe('chunkMarkdown pipeline', () => {
  it('should process simple.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/simple.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.stats).toBeDefined();
    expect(result.stats.totalChunks).toBeGreaterThan(0);
    expect(result.stats.totalTokens).toBeGreaterThan(0);
    expect(result.stats.processingTimeMs).toBeGreaterThan(0);
  });

  it('should process headings.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/headings.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.totalChunks).toBe(result.chunks.length);
    expect(result.stats.minTokens).toBeGreaterThan(0);
    expect(result.stats.maxTokens).toBeGreaterThanOrEqual(result.stats.minTokens);
  });

  it('should process code-heavy.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/code-heavy.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.totalTokens).toBeGreaterThan(0);
    expect(result.stats.sourceLength).toBeGreaterThan(0);
    expect(result.stats.compressionRatio).toBeGreaterThan(0);
  });

  it('should process large-nodes.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/large-nodes.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.expectedChunks).toBeGreaterThan(0);
    expect(result.stats.actualChunks).toBe(result.chunks.length);
    expect(result.stats.efficiencyRatio).toBeGreaterThan(0);
  });

  it('should process mixed-content.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/mixed-content.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.tokenDistribution).toBeDefined();
    expect(result.stats.tokenDistribution.underTarget).toBeGreaterThanOrEqual(0);
    expect(result.stats.tokenDistribution.atTarget).toBeGreaterThanOrEqual(0);
    expect(result.stats.tokenDistribution.overTarget).toBeGreaterThanOrEqual(0);
  });

  it('should process small-nodes.md fixture with small options', () => {
    const content = readFileSync(join(__dirname, 'fixtures/small-nodes.md'), 'utf-8');
    const result = chunkMarkdown(content, smallOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.avgTokens).toBeGreaterThan(0);
    expect(result.stats.medianTokens).toBeGreaterThan(0);
    expect(result.stats.deviation).toBeGreaterThanOrEqual(0);
  });

  it('should process messy-content.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/messy-content.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.qualityFlag).toBeDefined();
    expect(typeof result.stats.qualityFlag).toBe('boolean');
  });

  it('should process skeleton-250.md fixture', () => {
    const content = readFileSync(join(__dirname, 'fixtures/skeleton-250.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.stats.processingTime).toMatch(/^\d+ms$/);
  });

  it('should handle empty content', () => {
    const result = chunkMarkdown('', defaultOptions);

    expect(result.chunks).toBeDefined();
    expect(result.chunks.length).toBe(0);
    expect(result.stats.totalChunks).toBe(0);
    expect(result.stats.totalTokens).toBe(0);
    expect(result.stats.processingTimeMs).toBeDefined();
  });

  it('should apply default options when not provided', () => {
    const content = readFileSync(join(__dirname, 'fixtures/simple.md'), 'utf-8');
    const result = chunkMarkdown(content, { strictMode: false, minTokens: 50, maxTokens: 300 });

    expect(result.chunks).toBeDefined();
    expect(result.stats).toBeDefined();
    expect(result.stats.totalChunks).toBeGreaterThanOrEqual(0);
  });

  it('should preserve chunk metadata', () => {
    const content = readFileSync(join(__dirname, 'fixtures/headings.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks.length).toBeGreaterThan(0);
    result.chunks.forEach(chunk => {
      expect(chunk.content).toBeDefined();
      expect(typeof chunk.content).toBe('string');
      expect(chunk.tokens).toBeDefined();
      expect(chunk.tokens).toBeGreaterThan(0);
    });
  });

  it('should maintain chunk token bounds', () => {
    const content = readFileSync(join(__dirname, 'fixtures/mixed-content.md'), 'utf-8');
    const result = chunkMarkdown(content, defaultOptions);

    expect(result.chunks.length).toBeGreaterThan(0);
    result.chunks.forEach(chunk => {
      expect(chunk.tokens).toBeGreaterThan(0);
      expect(chunk.tokens).toBeLessThanOrEqual(defaultOptions.maxTokens!);
    });
  });

  it('should calculate stats correctly across all fixtures', () => {
    const fixtures = ['simple.md', 'headings.md', 'code-heavy.md', 'large-nodes.md'];

    fixtures.forEach(fixture => {
      const content = readFileSync(join(__dirname, 'fixtures', fixture), 'utf-8');
      const result = chunkMarkdown(content, defaultOptions);

      expect(result.stats.totalChunks).toBe(result.chunks.length);
      expect(result.stats.sourceLength).toBeGreaterThan(0);

      if (result.chunks.length > 0) {
        const calculatedTotal = result.chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
        expect(result.stats.totalTokens).toBe(calculatedTotal);
      }
    });
  });
});