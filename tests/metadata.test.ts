import { describe, it, expect } from 'vitest';
import { attachMetadata } from '../lib/metadata';
import { countTokens } from '../lib/tokenizer';
import { Chunk, ChunkOptions } from '../lib/types';

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

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    expect(result[0].id).toBe('doc:processed-content.md::ch0');
    expect(result[1].id).toBe('doc:processed-content.md::ch1');
    expect(result[2].id).toBe('doc:processed-content.md::ch2');
  });

  it('should attach prev/next ID links correctly', () => {
    const chunks = [
      createChunk('First chunk'),
      createChunk('Second chunk'),
      createChunk('Third chunk')
    ];

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    // First chunk
    expect(result[0].prevId).toBeNull();
    expect(result[0].nextId).toBe('doc:processed-content.md::ch1');

    // Middle chunk
    expect(result[1].prevId).toBe('doc:processed-content.md::ch0');
    expect(result[1].nextId).toBe('doc:processed-content.md::ch2');

    // Last chunk
    expect(result[2].prevId).toBe('doc:processed-content.md::ch1');
    expect(result[2].nextId).toBeNull();
  });

  it('should extract and attach heading information', () => {
    const chunks = [
      createChunk('# Main Title\n\nContent under main title'),
      createChunk('## Subtitle\n\nContent under subtitle'),
      createChunk('Content without heading')
    ];

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    expect(result[0].metadata?.sectionTitle).toBe('# Main Title');
    expect(result[1].metadata?.sectionTitle).toBe('## Subtitle');
    expect(result[2].metadata?.sectionTitle).toBe('');
  });

  it('should detect and categorize node types correctly', () => {
    const chunks = [
      createChunk('# Heading\n\nRegular paragraph content'),
      createChunk('```javascript\nfunction test() {}\n```'),
      createChunk('- List item 1\n- List item 2'),
      createChunk('| Column 1 | Column 2 |\n|----------|----------|'),
      createChunk('> This is a blockquote\n\nRegular text')
    ];

    const result = attachMetadata(chunks, mockOptions, 'test-document');

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

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    const expectedTokens = countTokens(content);
    expect(result[0].tokenStats?.tokens).toBe(expectedTokens);
  });

  it('should calculate character offsets correctly', () => {
    const chunks = [
      createChunk('First'),   // 0-5
      createChunk('Second'),  // 5-11
      createChunk('Third')    // 11-16
    ];

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    expect(result[0].sourcePosition).toEqual({
      charStart: 0,
      charEnd: 5,
      totalChars: 16
    });

    expect(result[1].sourcePosition).toEqual({
      charStart: 5,
      charEnd: 11,
      totalChars: 16
    });

    expect(result[2].sourcePosition).toEqual({
      charStart: 11,
      charEnd: 16,
      totalChars: 16
    });
  });

  it('should attach core metadata fields', () => {
    const chunks = [createChunk('Test content')];

    const result = attachMetadata(chunks, mockOptions, 'test-document');
    const metadata = result[0].metadata!;

    expect(result[0].parentId).toBe('doc:processed-content.md');
    expect(result[0].chunkNumber).toBe(0);
    expect(metadata.contentType).toBe('doc');
    expect(metadata.sourceFile).toBe('processed-content.md');
    expect(typeof metadata.processedAt).toBe('string');
    expect(metadata.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should attach convenience flags for content analysis', () => {
    const chunks = [
      createChunk('# Heading with code\n\n```js\ncode here\n```'),
      createChunk('- List item\n\nRegular paragraph'),
      createChunk('Just regular paragraph text')
    ];

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    expect(result[0].metadata?.nodeTypes).toContain('code');
    expect(result[0].metadata?.nodeTypes).toContain('heading');
    expect(result[0].metadata?.nodeTypes).not.toContain('list-item');

    expect(result[1].metadata?.nodeTypes).not.toContain('code');
    expect(result[1].metadata?.nodeTypes).not.toContain('heading');
    expect(result[1].metadata?.nodeTypes).toContain('list-item');

    expect(result[2].metadata?.nodeTypes).not.toContain('code');
    expect(result[2].metadata?.nodeTypes).not.toContain('heading');
    expect(result[2].metadata?.nodeTypes).not.toContain('list-item');
  });

  it('should preserve existing metadata while adding new fields', () => {
    const existingMetadata = {
      customField: 'custom value',
      types: ['custom-type'],
      headingTrail: ['Existing', 'Trail']
    };

    const chunks = [createChunk('# New Heading\n\nContent', existingMetadata)];

    const result = attachMetadata(chunks, mockOptions, 'test-document');
    const metadata = result[0].metadata!;

    expect(metadata.customField).toBe('custom value');
    expect(metadata.nodeTypes).toEqual(['custom-type']); // Should preserve existing
    expect(metadata.headerPath).toEqual(['Existing', 'Trail']); // Should preserve existing
    expect(result[0].id).toBe('doc:processed-content.md::ch0'); // Should add new fields
  });

  it('should handle empty chunks gracefully', () => {
    const chunks = [createChunk('')];

    const result = attachMetadata(chunks, mockOptions, 'test-document');
    const metadata = result[0].metadata!;

    expect(result[0].id).toBe('doc:processed-content.md::ch0');
    expect(metadata.sectionTitle).toBe('');
    expect(metadata.nodeTypes).toEqual(['paragraph']); // Default to paragraph
  });

  it('should handle single chunk correctly', () => {
    const chunks = [createChunk('Single chunk content')];

    const result = attachMetadata(chunks, mockOptions, 'test-document');
    const metadata = result[0].metadata!;

    expect(result[0].id).toBe('doc:processed-content.md::ch0');
    expect(result[0].prevId).toBeNull();
    expect(result[0].nextId).toBeNull();
    expect(result[0].chunkNumber).toBe(0);
  });

  it('should attach content length metadata', () => {
    const shortContent = 'Short';
    const longContent = 'This is a much longer piece of content with more characters';

    const chunks = [
      createChunk(shortContent),
      createChunk(longContent)
    ];

    const result = attachMetadata(chunks, mockOptions, 'test-document');

    expect(result[0].originalText?.length).toBe(shortContent.length);
    expect(result[1].originalText?.length).toBe(longContent.length);
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

    const result = attachMetadata(chunks, mockOptions, 'test-document');
    const metadata = result[0].metadata!;

    expect(metadata.nodeTypes).toContain('heading');
    expect(metadata.nodeTypes).toContain('code');
    expect(metadata.nodeTypes).toContain('list-item');
    expect(metadata.nodeTypes).toContain('table');
    expect(metadata.nodeTypes).toContain('blockquote');
    expect(metadata.nodeTypes).toContain('paragraph');

    expect(metadata.nodeTypes).toContain('code');
    expect(metadata.nodeTypes).toContain('heading');
    expect(metadata.nodeTypes).toContain('list-item');

    expect(metadata.sectionTitle).toBe('# API Documentation');
  });
});