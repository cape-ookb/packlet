import { describe, it, expect } from 'vitest';
import { assertOrFilterInvalid } from '../guardrails';
import { countTokens } from '../tokenizer';
import { Chunk, ChunkOptions } from '../types';

describe('guardrails', () => {
  const createChunk = (content: string, tokens?: number): Chunk => ({
    content,
    tokens: tokens ?? countTokens(content),
    metadata: {}
  });

  const defaultOptions: ChunkOptions = {
    minTokens: 50,
    maxTokens: 200,
    overlapSentences: 1,
    strictMode: false
  };

  const strictOptions: ChunkOptions = {
    ...defaultOptions,
    strictMode: true
  };

  describe('empty content validation', () => {
    it('should detect empty chunks', () => {
      const chunks = [createChunk(''), createChunk('   '), createChunk('\n\n\t  \n')];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should throw on empty chunks in strict mode', () => {
      const chunks = [createChunk('')];

      expect(() => assertOrFilterInvalid(chunks, strictOptions))
        .toThrow('Chunk validation failed: EMPTY_CONTENT');
    });
  });

  describe('token count validation', () => {
    it('should detect chunks that are too short', () => {
      // Create a very short chunk (well below 50 tokens)
      const shortContent = 'Short';
      const chunks = [createChunk(shortContent, 5)];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should detect chunks that are too long', () => {
      // Create a chunk that exceeds maxTokens
      const longContent = 'Very '.repeat(100) + 'long content';
      const chunks = [createChunk(longContent, 250)];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should throw on too short chunks in strict mode', () => {
      const chunks = [createChunk('Short', 5)];

      expect(() => assertOrFilterInvalid(chunks, strictOptions))
        .toThrow('Chunk validation failed: TOO_SHORT');
    });

    it('should throw on too long chunks in strict mode', () => {
      const chunks = [createChunk('Very long content', 250)];

      expect(() => assertOrFilterInvalid(chunks, strictOptions))
        .toThrow('Chunk validation failed: TOO_LONG');
    });

    it('should accept chunks within valid token range', () => {
      const validContent = 'This is a reasonably sized chunk with enough content to meet the minimum token requirements while staying under the maximum limit.';
      const chunks = [createChunk(validContent, 75)];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(validContent);
    });
  });

  describe('formatting-only validation', () => {
    it('should detect empty headers', () => {
      const chunks = [
        createChunk('###'),
        createChunk('## '),
        createChunk('###### ')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should detect horizontal rules only', () => {
      const chunks = [
        createChunk('---'),
        createChunk('----'),
        createChunk('-----')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should detect empty code blocks', () => {
      const chunks = [
        createChunk('```'),
        createChunk('````'),
        createChunk('`````')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should detect emphasis characters only', () => {
      const chunks = [
        createChunk('***'),
        createChunk('___'),
        createChunk('---'),
        createChunk('* _ - '),
        createChunk('  *  _  -  ')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should detect table separators only', () => {
      const chunks = [
        createChunk('|'),
        createChunk('| | |'),
        createChunk('  |  |  ')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should detect blockquote markers only', () => {
      const chunks = [
        createChunk('>'),
        createChunk('> >'),
        createChunk('  >  ')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should accept formatting with content', () => {
      const chunks = [
        createChunk('## Real Heading\n\nThis is a substantial piece of content that provides enough context and information to meet the minimum token requirements for a valid chunk. It contains detailed explanations and comprehensive information that makes it valuable for retrieval and embedding purposes in a vector database system.'),
        createChunk('```javascript\nfunction example() {\n  const result = processData(input);\n  return result.map(item => transform(item));\n  console.log("Processing complete");\n}\n```\n\nThis code example shows how to process data with proper transformation steps. The function takes input data, processes it through a transformation pipeline, and returns the results with logging for debugging purposes.'),
        createChunk('> This is a real blockquote with substantial content that provides meaningful information and context sufficient to meet the minimum token requirements for validation. It demonstrates how blockquotes can contain valuable content that should be preserved during the chunking process and used effectively in applications.')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(3);
    });
  });

  describe('empty header validation', () => {
    it('should detect headers without content', () => {
      const chunks = [
        createChunk('# '),
        createChunk('## Empty'),
        createChunk('### Another Empty\n\n\n')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should accept headers with content', () => {
      const chunks = [
        createChunk('# Real Heading\n\nThis is substantial content that follows the heading, providing enough detail and context to meet the minimum token requirements for a valid chunk that passes validation. It contains comprehensive explanations and useful information that makes it valuable for document retrieval systems and embedding applications.'),
        createChunk('## Another Heading\n\nThis section contains comprehensive information and detailed explanations that ensure the chunk has sufficient content to meet token requirements and pass validation. The content provides meaningful context and detailed information that would be useful in a vector database for semantic search applications and document analysis.')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(2);
    });
  });

  describe('orphaned code validation', () => {
    it('should detect code blocks without sufficient context', () => {
      const chunks = [
        createChunk('```javascript\nfunction test() { return true; }\n```'),
        createChunk('```python\ndef example():\n    pass\n```\n\nShort.'),
        createChunk('`inline code` with `more code` but little prose')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should accept code with sufficient context', () => {
      const contextText = 'This is a detailed explanation of the following code implementation. '.repeat(5);
      const chunks = [
        createChunk(`${contextText}\n\n\`\`\`javascript\nfunction test() { return true; }\n\`\`\``),
        createChunk(`Here's how to use this function: ${contextText}\n\n\`inline code\` example`)
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(2);
    });

    it('should accept chunks without any code', () => {
      const chunks = [
        createChunk('This is just regular text without any code examples or snippets. It contains substantial content with detailed explanations, comprehensive information, and sufficient context to meet the minimum token requirements for validation. The content provides meaningful information that would be valuable for retrieval and embedding purposes.')
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(1);
    });
  });

  describe('mixed validation scenarios', () => {
    it('should handle multiple validation errors for single chunk', () => {
      const chunks = [createChunk('###', 2)]; // Both formatting-only AND too short

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(0);
    });

    it('should filter out invalid chunks while keeping valid ones', () => {
      const validContent = 'This is a valid chunk with sufficient content and proper token count to pass all validation checks.';
      const chunks = [
        createChunk(''), // Empty
        createChunk('###'), // Formatting only
        createChunk(validContent, 75), // Valid
        createChunk('Short', 5), // Too short
        createChunk('```js\ncode\n```') // Orphaned code
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe(validContent);
    });

    it('should throw on first error in strict mode', () => {
      const chunks = [
        createChunk(''), // This should cause the error
        createChunk('### Also invalid but should not be reached')
      ];

      expect(() => assertOrFilterInvalid(chunks, strictOptions))
        .toThrow('Chunk validation failed: EMPTY_CONTENT');
    });
  });

  describe('error reporting', () => {
    it('should provide detailed error messages', () => {
      const chunks = [createChunk('Short', 5)];

      expect(() => assertOrFilterInvalid(chunks, strictOptions))
        .toThrow('Chunk has 5 tokens, below minimum of 50');
    });

    it('should provide error codes for different violation types', () => {
      // Test each error type individually
      expect(() => assertOrFilterInvalid([createChunk('')], strictOptions))
        .toThrow(/EMPTY_CONTENT/);

      expect(() => assertOrFilterInvalid([createChunk('Short', 5)], strictOptions))
        .toThrow(/TOO_SHORT/);

      expect(() => assertOrFilterInvalid([createChunk('Long content', 250)], strictOptions))
        .toThrow(/TOO_LONG/);

      // Test with relaxed token requirements to isolate specific errors
      const relaxedOptions = { ...strictOptions, minTokens: 1, maxTokens: 1000 };

      expect(() => assertOrFilterInvalid([createChunk('###')], relaxedOptions))
        .toThrow(/FORMATTING_ONLY/);

      expect(() => assertOrFilterInvalid([createChunk('# Title\n\n\n')], relaxedOptions))
        .toThrow(/EMPTY_HEADER/);

      expect(() => assertOrFilterInvalid([createChunk('```js\ncode\n```')], relaxedOptions))
        .toThrow(/ORPHANED_CODE/);
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic document chunks', () => {
      const chunks = [
        // Valid introduction
        createChunk('# API Documentation\n\nThis guide explains how to use our REST API for data management and retrieval.', 85),

        // Valid code example with context
        createChunk('Authentication is required for all endpoints. Here is how to authenticate:\n\n```javascript\nconst token = await getAuthToken();\napi.setAuth(token);\n```', 120),

        // Invalid: orphaned code
        createChunk('```python\ndef process_data(data):\n    return data.transform()\n```'),

        // Valid endpoint documentation
        createChunk('## GET /api/users\n\nRetrieve a list of all users in the system. Supports pagination and filtering parameters.', 95),

        // Invalid: empty header
        createChunk('### '),

        // Valid conclusion
        createChunk('For more information, visit our developer portal or contact support for additional assistance. Our documentation provides comprehensive guides and examples to help you integrate successfully.', 70)
      ];

      const result = assertOrFilterInvalid(chunks, defaultOptions);
      expect(result).toHaveLength(3); // Should keep 3 valid chunks, filter 3 invalid

      // Verify the valid chunks are preserved
      expect(result[0].content).toContain('API Documentation');
      expect(result[1].content).toContain('GET /api/users');
      expect(result[2].content).toContain('developer portal');
    });
  });
});