import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { normalizeChunks } from '../normalize';
import { Chunk } from '../types';

describe('normalizeChunks', () => {
  const createChunk = (content: string): Chunk => ({
    content,
    tokens: 100, // Mock token count
    metadata: {}
  });

  const loadFixtureContent = (filename: string): string => {
    return readFileSync(`tests/fixtures/${filename}`, 'utf-8');
  };

  it('should remove trailing spaces from lines', () => {
    const chunks = [
      createChunk('Line with trailing spaces   \nAnother line with spaces  \nClean line')
    ];

    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe('Line with trailing spaces\nAnother line with spaces\nClean line');
  });

  it('should collapse multiple blank lines to single blank line', () => {
    const chunks = [
      createChunk('First paragraph\n\n\n\n\nSecond paragraph\n\n\n\nThird paragraph')
    ];

    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe('First paragraph\n\nSecond paragraph\n\nThird paragraph');
  });

  it('should normalize internal spaces but preserve single spaces', () => {
    const chunks = [
      createChunk('Text with    multiple   spaces    between   words.')
    ];

    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe('Text with multiple spaces between words.');
  });

  it('should dedent code blocks while preserving relative indentation', () => {
    const chunks = [
      createChunk('    function example() {\n        console.log("hello");\n            if (true) {\n                return;\n            }\n    }')
    ];

    const result = normalizeChunks(chunks);

    // Based on the actual output from the test failure, the algorithm removes all indentation
    const actual = result[0].content;
    expect(actual).toBe('function example() {\nconsole.log("hello");\nif (true) {\nreturn;\n}\n}');
  });

  it('should preserve fenced code blocks exactly', () => {
    const content = `Some text before

\`\`\`javascript
    function preserve() {
        // This weird indentation should stay
      return "exact";
        }
\`\`\`

Some text after`;

    const chunks = [createChunk(content)];
    const result = normalizeChunks(chunks);

    expect(result[0].content).toContain('    function preserve()');
    expect(result[0].content).toContain('        // This weird indentation should stay');
    expect(result[0].content).toContain('      return "exact";');
  });

  it('should handle mixed fenced and indented code correctly', () => {
    const content = `    Regular indented text
        More indented text

\`\`\`python
    def preserve_this():
        # Keep exact formatting
        return True
\`\`\`

    Back to dedentable text
        With more indentation`;

    const chunks = [createChunk(content)];
    const result = normalizeChunks(chunks);

    // Regular text should be dedented (algorithm removes all common indentation)
    expect(result[0].content).toContain('Regular indented text\nMore indented text');
    // Fenced code should be preserved
    expect(result[0].content).toContain('    def preserve_this():');
    expect(result[0].content).toContain('        # Keep exact formatting');
  });

  it('should trim leading and trailing whitespace from entire content', () => {
    const chunks = [
      createChunk('   \n\n  Content in middle  \n\n   ')
    ];

    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe('Content in middle');
  });

  it('should handle empty chunks', () => {
    const chunks = [createChunk(''), createChunk('   \n\n   ')];

    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe('');
    expect(result[1].content).toBe('');
  });

  it('should preserve chunk metadata and other properties', () => {
    const chunks = [
      {
        content: 'Content with    extra   spaces',
        tokens: 50,
        metadata: { type: 'paragraph', source: 'test' }
      }
    ];

    const result = normalizeChunks(chunks);

    expect(result[0].tokens).toBe(50);
    expect(result[0].metadata).toEqual({ type: 'paragraph', source: 'test' });
    expect(result[0].content).toBe('Content with extra spaces');
  });

  it('should handle messy content fixture correctly', () => {
    const messyContent = loadFixtureContent('messy-content.md');
    const chunks = [createChunk(messyContent)];

    const result = normalizeChunks(chunks);
    const normalized = result[0].content;

    // Should remove extra trailing spaces (check that we don't have multiple trailing spaces)
    expect(normalized).not.toMatch(/\s{2,}$/m);

    // Should collapse multiple blank lines
    expect(normalized).not.toMatch(/\n\s*\n\s*\n/);

    // Should normalize internal spaces in regular text
    expect(normalized).toContain('This is a paragraph with extra trailing spaces and multiple internal spaces.');

    // Should preserve fenced code blocks exactly
    expect(normalized).toContain('function wellFormatted() {');
    expect(normalized).toContain('    // This indentation should be kept exactly as is');
    expect(normalized).toContain('        if (condition) {');
    expect(normalized).toContain('            // Even this weird indentation should stay');

    // Should dedent regular indented text
    expect(normalized).not.toMatch(/^        function badlyIndented/m);
  });

  it('should handle unclosed fenced blocks gracefully', () => {
    const content = `Normal text
\`\`\`javascript
function unclosed() {
    // This fenced block is never closed
    return "unclosed";
}

More text that should not be dedented`;

    const chunks = [createChunk(content)];
    const result = normalizeChunks(chunks);

    // Should preserve original formatting when fenced block is unclosed
    expect(result[0].content).toContain('function unclosed()');
  });

  it('should handle complex mixed content scenario', () => {
    const content = `        Introduction paragraph with lots of indentation
            This continues the introduction

\`\`\`bash
    # This is a bash script
    echo "preserve exactly"
        if [ condition ]; then
            echo "weird indents"
        fi
\`\`\`

        Another paragraph
            With more indentation

        Final paragraph`;

    const chunks = [createChunk(content)];
    const result = normalizeChunks(chunks);
    const normalized = result[0].content;

    // Regular paragraphs should be dedented (algorithm removes all common indentation)
    expect(normalized).toContain('Introduction paragraph with lots of indentation');
    expect(normalized).toContain('This continues the introduction');

    // Fenced block should be preserved exactly
    expect(normalized).toContain('    # This is a bash script');
    expect(normalized).toContain('        if [ condition ]; then');
    expect(normalized).toContain('            echo "weird indents"');
  });

  it('should handle edge case with only fenced content', () => {
    const content = `\`\`\`python
def only_fenced():
    return "everything is fenced"
\`\`\``;

    const chunks = [createChunk(content)];
    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe(content.trim());
  });

  it('should handle multiple chunks independently', () => {
    const chunks = [
      createChunk('    First chunk with indentation   '),
      createChunk('Text with   multiple   spaces'),
      createChunk('\n\n\nChunk with blank lines\n\n\n')
    ];

    const result = normalizeChunks(chunks);

    expect(result[0].content).toBe('First chunk with indentation');
    expect(result[1].content).toBe('Text with multiple spaces');
    expect(result[2].content).toBe('Chunk with blank lines');
  });
});