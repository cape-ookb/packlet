import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { countTokens } from '../tokenizer.ts';

describe('countTokens', () => {
  it('should count tokens for simple text', () => {
    const text = 'Hello world';
    const tokens = countTokens(text);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10); // Should be 2-3 tokens typically
  });

  it('should count tokens for empty string', () => {
    const tokens = countTokens('');
    expect(tokens).toBe(0); // Empty string should have 0 tokens
  });

  it('should count tokens for single character', () => {
    const tokens = countTokens('a');
    expect(tokens).toBe(1);
  });

  it('should count tokens for code snippet', () => {
    const code = `function hello() {
  console.log("Hello, world!");
}`;
    const tokens = countTokens(code);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(50);
  });

  it('should count tokens for simple.md fixture', () => {
    const content = readFileSync('tests/fixtures/simple.md', 'utf-8');
    const tokens = countTokens(content);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(200); // Reasonable upper bound for the simple fixture
  });

  it('should count tokens for code-heavy.md fixture', () => {
    const content = readFileSync('tests/fixtures/code-heavy.md', 'utf-8');
    const tokens = countTokens(content);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should count tokens for headings.md fixture', () => {
    const content = readFileSync('tests/fixtures/headings.md', 'utf-8');
    const tokens = countTokens(content);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should count tokens consistently for same input', () => {
    const text = 'This is a test sentence with multiple words.';
    const tokens1 = countTokens(text);
    const tokens2 = countTokens(text);
    expect(tokens1).toBe(tokens2);
  });

  it('should handle unicode characters', () => {
    const text = 'Hello 世界 🌍';
    const tokens = countTokens(text);
    expect(tokens).toBeGreaterThan(0);
  });

  it('should verify sample text token counts', () => {
    // Known token counts for validation
    const samples = [
      { text: 'Hello', expectedRange: [1, 2] },
      { text: 'Hello world', expectedRange: [2, 4] },
      { text: 'The quick brown fox jumps over the lazy dog', expectedRange: [8, 12] },
    ];

    samples.forEach(({ text, expectedRange }) => {
      const tokens = countTokens(text);
      expect(tokens).toBeGreaterThanOrEqual(expectedRange[0]);
      expect(tokens).toBeLessThanOrEqual(expectedRange[1]);
    });
  });
});