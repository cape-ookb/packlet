import { describe, it, expect } from 'vitest';
import { packNodes } from '../lib/packer';
import { ChunkOptions } from '../lib/types';
import { FlatNode } from '../lib/flatten-ast';
import { countTokens } from '../lib/tokenizer';

describe('Packer Unit Tests', () => {
  const createTestNode = (text: string, type: 'heading' | 'paragraph' | 'code' = 'paragraph'): FlatNode => ({
    type,
    text,
    headingTrail: [],
    headingDepths: [],
    tokenCount: Math.ceil(text.length / 4), // Rough approximation
    position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: text.length, offset: text.length } }
  });

  it('should never create chunks that exceed maxTokens', () => {
    // Create nodes that could potentially be merged into oversized chunks
    const nodes: FlatNode[] = [
      createTestNode('This is a substantial paragraph with enough content to be around 200 tokens when we include all the words and make it quite verbose with additional text to reach the target size. '.repeat(4), 'paragraph'),
      createTestNode('Another substantial paragraph that is also quite large and could combine with the previous one to exceed our maxTokens limit if we are not careful about size checking. '.repeat(4), 'paragraph'),
      createTestNode('A third paragraph that adds even more content and definitely would exceed maxTokens if combined with the previous paragraphs without proper validation. '.repeat(4), 'paragraph')
    ];

    const options: ChunkOptions = {
      maxTokens: 300,  // Intentionally small to test boundary
      minTokens: 50,
      targetTokens: 200,
      overlapSentences: 1,
      strictMode: true,
      breadcrumbMode: 'conditional'
    };

    const chunks = packNodes(nodes, options);

    // Critical test: NO chunk should exceed maxTokens
    chunks.forEach((chunk, index) => {
      expect(chunk.tokens, `Chunk ${index + 1} exceeds maxTokens`).toBeLessThanOrEqual(options.maxTokens);
    });
  });

  it('should demonstrate the maxTokens violation bug', () => {
    // This test is designed to fail and expose the bug
    // Create a scenario that triggers the oversized chunk issue

    const nodes: FlatNode[] = [
      createTestNode('# Section A\n\nThis is content for section A. '.repeat(10), 'heading'),
      createTestNode('This is a paragraph that should be small enough to merge. '.repeat(8), 'paragraph'),
      createTestNode('Another paragraph that when combined might exceed limits. '.repeat(8), 'paragraph'),
      createTestNode('Final paragraph that could push us over the edge. '.repeat(8), 'paragraph')
    ];

    const options: ChunkOptions = {
      maxTokens: 200,  // Small limit to trigger the issue
      minTokens: 30,
      targetTokens: 150,
      overlapSentences: 2,
      strictMode: false, // Disable strict mode to see the actual chunks produced
      breadcrumbMode: 'conditional'
    };

    const chunks = packNodes(nodes, options);

    // Check if any chunks violate maxTokens (this might fail, exposing the bug)
    const oversizedChunks = chunks.filter(chunk => (chunk.tokens || 0) > options.maxTokens);

    if (oversizedChunks.length > 0) {
      console.log('BUG DETECTED: Found oversized chunks:');
      oversizedChunks.forEach((chunk, index) => {
        console.log(`  Chunk ${index + 1}: ${chunk.tokens} tokens (exceeds ${options.maxTokens})`);
        console.log(`  Content preview: ${(chunk.content || '').substring(0, 100)}...`);
      });
    }

    // This assertion should pass - if it fails, we've found the bug
    expect(oversizedChunks.length,
      `Found ${oversizedChunks.length} chunks exceeding maxTokens of ${options.maxTokens}`
    ).toBe(0);
  });

  it('should respect hard maxTokens limit even when targeting', () => {
    // Test the specific scenario where target-aware logic might bypass maxTokens
    const nodes: FlatNode[] = [
      createTestNode('Small section A with moderate content. '.repeat(15), 'paragraph'),
      createTestNode('Small section B that could merge with A. '.repeat(15), 'paragraph'),
      createTestNode('Small section C that might push the combined size over maxTokens. '.repeat(15), 'paragraph')
    ];

    const options: ChunkOptions = {
      maxTokens: 250,
      minTokens: 40,
      targetTokens: 200, // Target is close to max, which might trigger the bug
      overlapSentences: 2,
      strictMode: false,
      breadcrumbMode: 'conditional'
    };

    const chunks = packNodes(nodes, options);

    // Every single chunk must respect maxTokens - no exceptions
    chunks.forEach((chunk, index) => {
      const tokens = chunk.tokens || 0;
      expect(tokens,
        `Chunk ${index + 1} has ${tokens} tokens, exceeds maxTokens ${options.maxTokens}`
      ).toBeLessThanOrEqual(options.maxTokens);
    });

    // Additional check: verify no chunk is even close to violating (within 5 tokens)
    chunks.forEach((chunk, index) => {
      const tokens = chunk.tokens || 0;
      expect(tokens,
        `Chunk ${index + 1} has ${tokens} tokens, dangerously close to maxTokens ${options.maxTokens}`
      ).toBeLessThanOrEqual(options.maxTokens - 5);
    });
  });

  it('should handle edge case of final buffer merging without exceeding maxTokens', () => {
    // Test the specific flushFinalBuffer logic that was mentioned in the code comments
    const nodes: FlatNode[] = [
      createTestNode('Large first section with substantial content. '.repeat(20), 'paragraph'),
      createTestNode('Tiny final section.', 'paragraph') // This might trigger final buffer merging
    ];

    const options: ChunkOptions = {
      maxTokens: 200,
      minTokens: 50,
      targetTokens: 150,
      overlapSentences: 1,
      strictMode: false,
      breadcrumbMode: 'conditional'
    };

    const chunks = packNodes(nodes, options);

    // The final buffer merging logic should not exceed maxTokens
    chunks.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `Final buffer merge created oversized chunk ${index + 1}`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });

  it('should prioritize maxTokens over targetTokens when there is conflict', () => {
    // Test that maxTokens is treated as a hard limit, not a soft suggestion
    // Create multiple smaller nodes that could be merged beyond maxTokens
    const nodes: FlatNode[] = [
      createTestNode('First section with moderate content. '.repeat(8), 'paragraph'),  // ~80 tokens
      createTestNode('Second section that could merge. '.repeat(8), 'paragraph'),     // ~80 tokens
      createTestNode('Third section that would push us over. '.repeat(8), 'paragraph') // ~80 tokens
    ];

    const options: ChunkOptions = {
      maxTokens: 150,
      minTokens: 30,
      targetTokens: 140, // Very close to maxTokens - might trigger aggressive merging
      overlapSentences: 1,
      strictMode: false,
      breadcrumbMode: 'conditional'
    };

    const chunks = packNodes(nodes, options);

    // Debug information
    console.log('\nDEBUG: Chunk analysis for maxTokens violation:');
    chunks.forEach((chunk, index) => {
      console.log(`  Chunk ${index + 1}: ${chunk.tokens} tokens (maxTokens: ${options.maxTokens})`);
      console.log(`    Content preview: "${(chunk.content || '').substring(0, 80)}..."`);
    });
    console.log(`  Individual node sizes: ${nodes.map(n => n.tokenCount).join(', ')} tokens`);

    // Should create separate chunks rather than merge and exceed maxTokens
    expect(chunks.length).toBeGreaterThan(1);

    chunks.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `Chunk ${index + 1} exceeds hard maxTokens limit`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });

  it('should find the real bug that causes maxTokens violations in practice', () => {
    // Let's trace through what actually happens with real token counting
    // This test will use actual token counting, not our approximation


    const createRealNode = (text: string, type: 'heading' | 'paragraph' | 'code' = 'paragraph'): FlatNode => ({
      type,
      text,
      headingTrail: [],
      headingDepths: [],
      tokenCount: countTokens(text), // Use actual token counting
      position: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: text.length, offset: text.length } }
    });

    // Create a scenario similar to what might happen in docs/overlap.md
    const nodes: FlatNode[] = [
      createRealNode('# Overlap Strategy\n\nTheory: Forward-Only Overlap\n\nIn practice, you only need overlap in one direction (forward).\n\nHere\'s why:\n\n* When you chunk sequentially, each chunk carries forward context from the previous chunk\n* This provides continuity—whichever chunk is pulled during retrieval, the model sees enough surrounding context\n* Bidirectional overlap would double the redundancy, inflating storage and potentially confusing similarity scoring', 'heading'),
      createRealNode('The pattern looks like:\n\n```\n[----- Chunk 1 -----]\n              [overlap----- Chunk 2 -----]\n                                    [overlap----- Chunk 3 -----]\n```\n\nWhere `overlap` is content carried forward from the previous chunk\'s ending.\n\n## Implementation in This Project\n\nThis chunker implements **sentence-based forward overlap** (see `lib/overlap.ts`):', 'paragraph'),
      createRealNode('### Key Features\n\n1. **Sentence-Based**: Instead of raw token overlap, we extract complete sentences\n   - Preserves semantic units (complete thoughts)\n   - Better for retrieval quality\n   - Note: Header context is handled separately via breadcrumbs (see below)\n\n2. **Configurable Count**: Default is 2 sentences (see `lib/default-config.ts`)\n   - Set via `overlapSentences` option\n   - Typically 1-3 sentences works best', 'paragraph')
    ];

    console.log('\nDEBUG: Real token counts:');
    nodes.forEach((node, index) => {
      console.log(`  Node ${index + 1}: ${node.tokenCount} tokens`);
      console.log(`    Content: "${node.text.substring(0, 80)}..."`);
    });

    const options: ChunkOptions = {
      maxTokens: 512,  // Same as default
      minTokens: 64,
      targetTokens: 400,
      overlapSentences: 2,
      strictMode: false,
      breadcrumbMode: 'conditional'
    };

    const chunks = packNodes(nodes, options);

    console.log('\nDEBUG: Resulting chunks:');
    chunks.forEach((chunk, index) => {
      console.log(`  Chunk ${index + 1}: ${chunk.tokens} tokens (maxTokens: ${options.maxTokens})`);
      console.log(`    Content preview: "${(chunk.content || '').substring(0, 100)}..."`);
    });

    // This should reveal if we have any chunks exceeding maxTokens
    const oversizedChunks = chunks.filter(chunk => (chunk.tokens || 0) > options.maxTokens);

    if (oversizedChunks.length > 0) {
      console.log(`\nBUG FOUND: ${oversizedChunks.length} chunks exceed maxTokens!`);
      oversizedChunks.forEach((chunk, index) => {
        console.log(`  Oversized chunk ${index + 1}: ${chunk.tokens} tokens`);
      });
    }

    // This assertion should pass - if it fails, we've found the real bug
    chunks.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `Chunk ${index + 1} with ${chunk.tokens} tokens exceeds maxTokens ${options.maxTokens}`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });
});