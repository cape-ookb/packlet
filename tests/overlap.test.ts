import { describe, it, expect } from 'vitest';
import { addOverlap } from '../overlap';
import { countTokens } from '../tokenizer';
import { Chunk, ChunkOptions } from '../types';

describe('addOverlap', () => {
  const mockOptions: ChunkOptions = {
    minTokens: 50,
    maxTokens: 150,
    overlapSentences: 2
  };

  const createChunk = (content: string): Chunk => ({
    content,
    tokens: countTokens(content),
    metadata: {}
  });

  it('should not add overlap to first chunk', () => {
    const chunks = [
      createChunk('First chunk content with multiple sentences. This is the second sentence.'),
      createChunk('Second chunk content with different sentences. This is another sentence.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result[0].content).toBe(chunks[0].content);
    expect(result[0].content).not.toContain('Second chunk');
  });

  it('should add trailing sentences from previous chunk', () => {
    const chunks = [
      createChunk('First chunk has initial content. This is a second sentence. This is the third sentence.'),
      createChunk('Second chunk has different content. This continues the second chunk.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result[1].content).toContain('This is a second sentence.');
    expect(result[1].content).toContain('This is the third sentence.');
    expect(result[1].content).toContain('Second chunk has different content.');
  });

  it('should respect overlapSentences configuration', () => {
    const singleOverlapOptions = { ...mockOptions, overlapSentences: 1 };
    const chunks = [
      createChunk('First sentence here. Second sentence content. Third sentence text.'),
      createChunk('New chunk starts here. This is additional content.')
    ];

    const result = addOverlap(chunks, singleOverlapOptions, countTokens);

    expect(result[1].content).toContain('Third sentence text.');
    expect(result[1].content).not.toContain('Second sentence content.');
    expect(result[1].content).toContain('New chunk starts here.');
  });

  it('should handle chunks with no sentences properly', () => {
    const chunks = [
      createChunk('NoSentenceEndingHere'),
      createChunk('AnotherChunkWithoutSentences')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result[1].content).toContain('NoSentenceEndingHere');
    expect(result[1].content).toContain('AnotherChunkWithoutSentences');
  });

  it('should update token counts after adding overlap', () => {
    const chunks = [
      createChunk('First chunk content with sentences. This adds more text.'),
      createChunk('Second chunk content.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    const expectedTokens = countTokens(result[1].content);
    expect(result[1].tokens).toBe(expectedTokens);
    expect(result[1].tokens).toBeGreaterThan(chunks[1].tokens);
  });

  it('should handle empty chunks gracefully', () => {
    const chunks = [
      createChunk(''),
      createChunk('Content in second chunk.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result).toHaveLength(2);
    expect(result[1].content).toBe('Content in second chunk.');
  });

  it('should handle single chunk input', () => {
    const chunks = [createChunk('Only one chunk here.')];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Only one chunk here.');
  });

  it('should handle empty chunks array', () => {
    const result = addOverlap([], mockOptions, countTokens);

    expect(result).toEqual([]);
  });

  it('should handle zero overlap sentences', () => {
    const noOverlapOptions = { ...mockOptions, overlapSentences: 0 };
    const chunks = [
      createChunk('First chunk content. With multiple sentences.'),
      createChunk('Second chunk content. More content here.')
    ];

    const result = addOverlap(chunks, noOverlapOptions, countTokens);

    expect(result[0].content).toBe(chunks[0].content);
    expect(result[1].content).toBe(chunks[1].content);
  });

  it('should preserve chunk metadata', () => {
    const chunks = [
      { ...createChunk('First chunk.'), metadata: { type: 'intro' } },
      { ...createChunk('Second chunk.'), metadata: { type: 'content' } }
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result[0].metadata).toEqual({ type: 'intro' });
    expect(result[1].metadata).toEqual({ type: 'content' });
  });

  it('should handle multiple chunks with progressive overlap', () => {
    const chunks = [
      createChunk('First chunk sentence. Second sentence here.'),
      createChunk('Second chunk begins. Another sentence follows.'),
      createChunk('Third chunk starts. Final sentence added.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    // First chunk unchanged
    expect(result[0].content).toBe(chunks[0].content);

    // Second chunk has overlap from first
    expect(result[1].content).toContain('Second sentence here.');
    expect(result[1].content).toContain('Second chunk begins.');

    // Third chunk has overlap from second (not first)
    expect(result[2].content).toContain('Another sentence follows.');
    expect(result[2].content).toContain('Third chunk starts.');
    expect(result[2].content).not.toContain('First chunk sentence.');
  });

  it('should handle edge case where previous chunk has fewer sentences than requested', () => {
    const chunks = [
      createChunk('Only one sentence'),
      createChunk('Second chunk with content. Has multiple sentences here.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result[1].content).toContain('Only one sentence');
    expect(result[1].content).toContain('Second chunk with content.');
  });

  it('should handle complex punctuation in sentences', () => {
    const chunks = [
      createChunk('First sentence here! Second sentence with question? Third sentence ends.'),
      createChunk('New chunk content begins. More content follows.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    expect(result[1].content).toContain('Second sentence with question?');
    expect(result[1].content).toContain('Third sentence ends.');
    expect(result[1].content).toContain('New chunk content begins.');
  });

  it('should demonstrate sentence-based overlap vs token-based', () => {
    const chunks = [
      createChunk('This is a complete sentence with meaningful content. This is another complete sentence.'),
      createChunk('Starting the second chunk with new content.')
    ];

    const result = addOverlap(chunks, mockOptions, countTokens);

    // Should include complete sentences, not partial tokens
    expect(result[1].content).toMatch(/This is a complete sentence.*This is another complete sentence\./);
    expect(result[1].content).toContain('Starting the second chunk');
  });
});