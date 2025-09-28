import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { computeStats } from '../lib/stats';
import { countTokens } from '../lib/tokenizer';
import { Chunk, ChunkOptions } from '../lib/types';

describe('computeStats', () => {
  const createChunk = (content: string): Chunk => ({
    content,
    tokens: countTokens(content),
    metadata: {}
  });

  const defaultOptions: ChunkOptions = {
    minTokens: 100,
    maxTokens: 400,
    overlapSentences: 1,
    targetTokens: 250
  };

  const loadFixture = (filename: string): string => {
    return readFileSync(`tests/fixtures/${filename}`, 'utf-8');
  };

  describe('basic statistics', () => {
    it('should handle empty chunk array', () => {
      const stats = computeStats([], defaultOptions);

      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.minTokens).toBe(0);
      expect(stats.maxTokens).toBe(0);
      expect(stats.avgTokens).toBe(0);
      expect(stats.medianTokens).toBe(0);
      expect(stats.expectedChunks).toBe(0);
      expect(stats.actualChunks).toBe(0);
      expect(stats.efficiencyRatio).toBe(0);
      expect(stats.deviation).toBe(0);
      expect(stats.qualityFlag).toBe(false);
    });

    it('should compute basic token statistics for simple chunks', () => {
      const chunks = [
        createChunk('This is a short chunk with some content.'),
        createChunk('This is a medium length chunk with more substantial content that provides better context and information for testing purposes.'),
        createChunk('Short text.'),
        createChunk('This chunk has even more content than the previous ones, with detailed explanations and comprehensive information that makes it valuable.')
      ];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(4);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.minTokens).toBeLessThan(stats.maxTokens);
      expect(stats.avgTokens).toBeGreaterThan(0);
      expect(stats.medianTokens).toBeGreaterThan(0);
      expect(stats.sourceLength).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('should calculate median correctly for odd number of chunks', () => {
      const chunks = [
        createChunk('Text with exactly ten tokens for testing median calculation purposes.'), // ~10 tokens
        createChunk('Text with exactly twenty tokens for testing median calculation purposes with more content.'), // ~20 tokens
        createChunk('Text with exactly thirty tokens for testing median calculation purposes with even more substantial content here.') // ~30 tokens
      ];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(3);
      // Median should be the middle value
      const tokenCounts = chunks.map(chunk => chunk.tokens).sort((a, b) => a - b);
      expect(stats.medianTokens).toBe(Math.round(tokenCounts[1]));
    });

    it('should calculate median correctly for even number of chunks', () => {
      const chunks = [
        createChunk('Short text.'), // ~2 tokens
        createChunk('Medium length text content.'), // ~5 tokens
        createChunk('Longer text content with more words.'), // ~7 tokens
        createChunk('Much longer text content with significantly more words and information.') // ~12 tokens
      ];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(4);
      // Median should be average of middle two values
      const tokenCounts = chunks.map(chunk => chunk.tokens).sort((a, b) => a - b);
      const expectedMedian = Math.round((tokenCounts[1] + tokenCounts[2]) / 2);
      expect(stats.medianTokens).toBe(expectedMedian);
    });
  });

  describe('expected vs actual analysis', () => {
    it('should calculate expected chunks based on content length', () => {
      const content = 'a'.repeat(1000); // 1000 characters
      const chunks = [createChunk(content)];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.expectedChunks).toBeGreaterThan(0);
      expect(stats.actualChunks).toBe(1);
      expect(stats.efficiencyRatio).toBeGreaterThan(0);
      expect(stats.deviation).toBeGreaterThan(0);
    });

    it('should flag quality issues when deviation is high', () => {
      // Create many small chunks that would deviate significantly from expected
      const chunks = Array(20).fill(null).map(() => createChunk('Short.'));

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.deviation).toBeGreaterThan(0.2);
      expect(stats.qualityFlag).toBe(true);
    });

    it('should compute deviation for realistic scenarios', () => {
      // Create content that naturally leads to expected chunking
      const content = 'This is content. '.repeat(100); // ~200 tokens total
      const chunks = [createChunk(content)];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.deviation).toBeGreaterThanOrEqual(0);
      expect(stats.deviation).toBeLessThanOrEqual(1.5); // Reasonable upper bound
      expect(typeof stats.qualityFlag).toBe('boolean');
    });
  });

  describe('token distribution analysis', () => {
    it('should categorize chunks by target token range', () => {
      const targetTokens = 50; // Lower target to match actual token counts
      const tolerance = 5; // 10% of 50

      const chunks = [
        createChunk('Short text.'), // Under target (~3 tokens)
        createChunk('This is a medium length chunk with exactly the right amount of content to hit our target token count for testing. It provides comprehensive information while maintaining exactly the right token length that we want for our distribution analysis tests. This content should be precisely within our target range.'), // At target (~47-53 tokens)
        createChunk('Medium chunk content.'), // Under target (~4 tokens)
        createChunk('This is an extremely long chunk that significantly exceeds our target token count by including extensive additional content, detailed explanations, comprehensive coverage of multiple topics, elaborate descriptions, redundant information, repetitive phrases, and unnecessary verbosity that pushes the token count well beyond our target range for testing purposes. This ensures we have content that clearly exceeds the target.') // Over target (~65+ tokens)
      ];

      const stats = computeStats(chunks, { ...defaultOptions, targetTokens });

      expect(stats.tokenDistribution.underTarget).toBeGreaterThan(0);
      expect(stats.tokenDistribution.atTarget).toBeGreaterThan(0);
      expect(stats.tokenDistribution.overTarget).toBeGreaterThan(0);
      expect(stats.tokenDistribution.underTarget + stats.tokenDistribution.atTarget + stats.tokenDistribution.overTarget).toBe(4);
    });
  });

  describe('fixture-based testing', () => {
    it('should compute stats for simple.md fixture', () => {
      const content = loadFixture('simple.md');
      const chunks = [createChunk(content)];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.sourceLength).toBe(content.length);
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.minTokens).toBe(stats.maxTokens); // Single chunk
      expect(stats.avgTokens).toBe(stats.totalTokens);
    });

    it('should compute stats for mixed-content.md fixture', () => {
      const content = loadFixture('mixed-content.md');

      // Simulate realistic chunking by splitting content into reasonable chunks
      const chunkSize = 500; // characters per chunk
      const chunks: Chunk[] = [];

      for (let i = 0; i < content.length; i += chunkSize) {
        const chunkContent = content.slice(i, i + chunkSize);
        if (chunkContent.trim()) {
          chunks.push(createChunk(chunkContent));
        }
      }

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBeGreaterThan(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.sourceLength).toBeGreaterThan(0);
      expect(stats.expectedChunks).toBeGreaterThan(0);
      expect(stats.efficiencyRatio).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThan(0);
    });

    it('should compute stats for large-nodes.md fixture', () => {
      const content = loadFixture('large-nodes.md');
      const chunks = [createChunk(content)];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(100); // Should be substantial
      expect(stats.sourceLength).toBe(content.length);
      expect(stats.maxTokens).toBe(stats.avgTokens); // Single chunk so max = avg
      expect(stats.deviation).toBeGreaterThan(0); // Likely different from expected
    });

    it('should compute stats for code-heavy.md fixture', () => {
      const content = loadFixture('code-heavy.md');

      // Split into chunks to simulate processing
      const paragraphs = content.split('\n\n').filter(p => p.trim());
      const chunks = paragraphs.map(p => createChunk(p));

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBeGreaterThan(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.minTokens).toBeGreaterThan(0);
      expect(stats.maxTokens).toBeGreaterThanOrEqual(stats.minTokens);
      expect(stats.avgTokens).toBeGreaterThan(0);
      expect(stats.medianTokens).toBeGreaterThan(0);
    });
  });

  describe('edge cases and validation', () => {
    it('should handle single chunk', () => {
      const chunks = [createChunk('Single chunk content for testing.')];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(1);
      expect(stats.minTokens).toBe(stats.maxTokens);
      expect(stats.avgTokens).toBe(stats.totalTokens);
      expect(stats.medianTokens).toBe(stats.totalTokens);
    });

    it('should handle chunks with zero tokens', () => {
      const chunks = [
        { content: '', tokens: 0, metadata: {} },
        createChunk('Normal chunk with content.')
      ];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(2);
      expect(stats.minTokens).toBe(0);
      expect(stats.totalTokens).toBeGreaterThan(0);
    });

    it('should handle very large token counts', () => {
      const chunks = [
        { content: 'Large chunk', tokens: 10000, metadata: {} },
        { content: 'Another large chunk', tokens: 15000, metadata: {} }
      ];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.totalChunks).toBe(2);
      expect(stats.totalTokens).toBe(25000);
      expect(stats.maxTokens).toBe(15000);
      expect(stats.minTokens).toBe(10000);
      expect(stats.avgTokens).toBe(12500);
    });

    it('should compute efficiency ratio correctly', () => {
      const chunks = [
        createChunk('Test chunk one with adequate content for analysis.'),
        createChunk('Test chunk two with similar length and token count.'),
        createChunk('Test chunk three maintaining consistency in size.')
      ];

      const stats = computeStats(chunks, defaultOptions);

      expect(stats.efficiencyRatio).toBeGreaterThan(0);
      expect(stats.efficiencyRatio).toBeLessThanOrEqual(5.0); // Reasonable upper bound for test chunks
      expect(stats.actualChunks).toBe(3);
      expect(stats.expectedChunks).toBeGreaterThan(0);
    });
  });
});