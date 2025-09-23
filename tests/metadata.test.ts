import { describe, it, expect } from 'vitest';
import { attachMetadata } from '../metadata';
import { countTokens } from '../tokenizer';
import { Chunk, ChunkOptions } from '../types';

describe('attachMetadata', () => {
  const mockOptions: ChunkOptions = {
    minTokens: 50,
    maxTokens: 150,
    overlapSentences: 1
  };

  const createChunk = (content: string, existingMetadata: Record<string, any> = {}): Chunk => ({
    content,
    tokens: countTokens(content),
    metadata: existingMetadata
  });

  it('should attach unique chunk IDs with correct format', () => {
    const chunks = [
      createChunk('First chunk content'),
      createChunk('Second chunk content'),
      createChunk('Third chunk content')
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    expect(result[0].metadata?.id).toBe('doc:chunker-output::ch0');
    expect(result[1].metadata?.id).toBe('doc:chunker-output::ch1');
    expect(result[2].metadata?.id).toBe('doc:chunker-output::ch2');
  });

  it('should attach prev/next ID links correctly', () => {
    const chunks = [
      createChunk('First chunk'),
      createChunk('Second chunk'),
      createChunk('Third chunk')
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    // First chunk
    expect(result[0].metadata?.prevId).toBeNull();
    expect(result[0].metadata?.nextId).toBe('doc:chunker-output::ch1');

    // Middle chunk
    expect(result[1].metadata?.prevId).toBe('doc:chunker-output::ch0');
    expect(result[1].metadata?.nextId).toBe('doc:chunker-output::ch2');

    // Last chunk
    expect(result[2].metadata?.prevId).toBe('doc:chunker-output::ch1');
    expect(result[2].metadata?.nextId).toBeNull();
  });

  it('should extract and attach heading information', () => {
    const chunks = [
      createChunk('# Main Title\n\nContent under main title'),
      createChunk('## Subtitle\n\nContent under subtitle'),
      createChunk('Content without heading')
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    expect(result[0].metadata?.heading).toBe('# Main Title');
    expect(result[1].metadata?.heading).toBe('## Subtitle');
    expect(result[2].metadata?.heading).toBe('');
  });

  it('should detect and categorize node types correctly', () => {
    const chunks = [
      createChunk('# Heading\n\nRegular paragraph content'),
      createChunk('```javascript\nfunction test() {}\n```'),
      createChunk('- List item 1\n- List item 2'),
      createChunk('| Column 1 | Column 2 |\n|----------|----------|'),
      createChunk('> This is a blockquote\n\nRegular text')
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    expect(result[0].metadata?.nodeTypes).toContain('heading');
    expect(result[0].metadata?.nodeTypes).toContain('paragraph');

    expect(result[1].metadata?.nodeTypes).toContain('code');
    expect(result[1].metadata?.nodeTypes).toContain('paragraph');

    expect(result[2].metadata?.nodeTypes).toContain('list-item');
    expect(result[2].metadata?.nodeTypes).toContain('paragraph');

    expect(result[3].metadata?.nodeTypes).toContain('table');
    expect(result[3].metadata?.nodeTypes).toContain('paragraph');

    expect(result[4].metadata?.nodeTypes).toContain('blockquote');
    expect(result[4].metadata?.nodeTypes).toContain('paragraph');
  });

  it('should calculate accurate token counts', () => {
    const content = 'This is a test sentence with multiple words for token counting.';
    const chunks = [createChunk(content)];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    const expectedTokens = countTokens(content);
    expect(result[0].tokens).toBe(expectedTokens);
    expect(result[0].metadata?.tokenCount).toBe(expectedTokens);
  });

  it('should calculate character offsets correctly', () => {
    const chunks = [
      createChunk('First'),   // 0-5
      createChunk('Second'),  // 5-11
      createChunk('Third')    // 11-16
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    expect(result[0].metadata?.charOffsets).toEqual({
      charStart: 0,
      charEnd: 5,
      sourceLength: 16
    });

    expect(result[1].metadata?.charOffsets).toEqual({
      charStart: 5,
      charEnd: 11,
      sourceLength: 16
    });

    expect(result[2].metadata?.charOffsets).toEqual({
      charStart: 11,
      charEnd: 16,
      sourceLength: 16
    });
  });

  it('should attach core metadata fields', () => {
    const chunks = [createChunk('Test content')];

    const result = attachMetadata(chunks, mockOptions, countTokens);
    const metadata = result[0].metadata!;

    expect(metadata.parentId).toBe('doc:chunker-output');
    expect(metadata.chunkNumber).toBe(0);
    expect(metadata.contentType).toBe('doc');
    expect(metadata.source).toBe('chunker-output');
    expect(metadata.fileName).toBe('processed-content.md');
    expect(typeof metadata.timestamp).toBe('string');
    expect(metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should attach convenience flags for content analysis', () => {
    const chunks = [
      createChunk('# Heading with code\n\n```js\ncode here\n```'),
      createChunk('- List item\n\nRegular paragraph'),
      createChunk('Just regular paragraph text')
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    expect(result[0].metadata?.hasCode).toBe(true);
    expect(result[0].metadata?.hasHeadings).toBe(true);
    expect(result[0].metadata?.hasLists).toBe(false);

    expect(result[1].metadata?.hasCode).toBe(false);
    expect(result[1].metadata?.hasHeadings).toBe(false);
    expect(result[1].metadata?.hasLists).toBe(true);

    expect(result[2].metadata?.hasCode).toBe(false);
    expect(result[2].metadata?.hasHeadings).toBe(false);
    expect(result[2].metadata?.hasLists).toBe(false);
  });

  it('should preserve existing metadata while adding new fields', () => {
    const existingMetadata = {
      customField: 'custom value',
      types: ['custom-type'],
      headingTrail: ['Existing', 'Trail']
    };

    const chunks = [createChunk('# New Heading\n\nContent', existingMetadata)];

    const result = attachMetadata(chunks, mockOptions, countTokens);
    const metadata = result[0].metadata!;

    expect(metadata.customField).toBe('custom value');
    expect(metadata.nodeTypes).toEqual(['custom-type']); // Should preserve existing
    expect(metadata.headerPath).toEqual(['Existing', 'Trail']); // Should preserve existing
    expect(metadata.id).toBe('doc:chunker-output::ch0'); // Should add new fields
  });

  it('should handle empty chunks gracefully', () => {
    const chunks = [createChunk('')];

    const result = attachMetadata(chunks, mockOptions, countTokens);
    const metadata = result[0].metadata!;

    expect(metadata.id).toBe('doc:chunker-output::ch0');
    expect(metadata.heading).toBe('');
    expect(metadata.nodeTypes).toEqual(['paragraph']); // Default to paragraph
    expect(metadata.tokenCount).toBe(0);
    expect(metadata.contentLength).toBe(0);
  });

  it('should handle single chunk correctly', () => {
    const chunks = [createChunk('Single chunk content')];

    const result = attachMetadata(chunks, mockOptions, countTokens);
    const metadata = result[0].metadata!;

    expect(metadata.id).toBe('doc:chunker-output::ch0');
    expect(metadata.prevId).toBeNull();
    expect(metadata.nextId).toBeNull();
    expect(metadata.chunkNumber).toBe(0);
  });

  it('should attach content length metadata', () => {
    const shortContent = 'Short';
    const longContent = 'This is a much longer piece of content with more characters';

    const chunks = [
      createChunk(shortContent),
      createChunk(longContent)
    ];

    const result = attachMetadata(chunks, mockOptions, countTokens);

    expect(result[0].metadata?.contentLength).toBe(shortContent.length);
    expect(result[1].metadata?.contentLength).toBe(longContent.length);
  });

  it('should handle complex mixed content', () => {
    const complexContent = `# API Documentation

## Authentication

Use the following code to authenticate:

\`\`\`javascript
const token = getAuthToken();
api.authenticate(token);
\`\`\`

### Requirements

- Valid API key
- Network access
- Node.js >= 14.0.0

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | /api/v1  | Get data    |

> Note: This is important information.`;

    const chunks = [createChunk(complexContent)];

    const result = attachMetadata(chunks, mockOptions, countTokens);
    const metadata = result[0].metadata!;

    expect(metadata.nodeTypes).toContain('heading');
    expect(metadata.nodeTypes).toContain('code');
    expect(metadata.nodeTypes).toContain('list-item');
    expect(metadata.nodeTypes).toContain('table');
    expect(metadata.nodeTypes).toContain('blockquote');
    expect(metadata.nodeTypes).toContain('paragraph');

    expect(metadata.hasCode).toBe(true);
    expect(metadata.hasHeadings).toBe(true);
    expect(metadata.hasLists).toBe(true);

    expect(metadata.heading).toBe('# API Documentation');
  });
});