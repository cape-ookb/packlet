import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from '../lib/index';
import { ChunkOptions } from '../lib/types';

describe('Pipeline maxTokens Violations', () => {
  it('should trace where maxTokens violations occur in the full pipeline', () => {
    // Use a content that we know causes issues
    const problematicContent = `# Test Document

## Section A

This is a substantial section with enough content that when combined with other sections and after overlap processing might exceed the maxTokens limit. Let me add more content to make this section substantial enough to potentially cause issues when the pipeline processes it.

Here is additional content for this section. We want to create a scenario where individual sections are reasonable but after processing they might become too large.

## Section B

Another section that individually is fine but when combined with overlap and other processing might contribute to exceeding maxTokens. This section also needs to be substantial enough to demonstrate the issue.

More content for section B to ensure we have enough text to potentially trigger the maxTokens violation when processed through the full pipeline.

## Section C

A third section that could be the final straw that pushes the combined chunk over the maxTokens limit after all pipeline processing is complete.

Even more content to ensure this section is substantial and could contribute to a maxTokens violation.`;

    const options: ChunkOptions = {
      maxTokens: 200,  // Small limit to trigger the issue
      minTokens: 50,
      targetTokens: 150,
      overlapSentences: 2,
      strictMode: false,  // Use lenient mode to see what happens
      breadcrumbMode: 'conditional'
    };

    const result = chunkMarkdown(problematicContent, 'test-document.md', options);
    const chunks = result.chunks;

    console.log('\nDEBUG: Full pipeline results:');
    chunks.forEach((chunk, index) => {
      console.log(`  Chunk ${index + 1}: ${chunk.tokens} tokens (maxTokens: ${options.maxTokens})`);
      console.log(`    Original text length: ${(chunk.originalText || '').length} chars`);
      console.log(`    Content length: ${(chunk.content || '').length} chars`);
      console.log(`    Embed text length: ${(chunk.embedText || '').length} chars`);
      console.log(`    Content preview: "${(chunk.content || '').substring(0, 80)}..."`);
      console.log('');
    });

    // Check for violations
    const violations = chunks.filter(chunk => (chunk.tokens || 0) > options.maxTokens);

    if (violations.length > 0) {
      console.log(`BUG DETECTED: ${violations.length} chunks exceed maxTokens!`);
      violations.forEach((chunk, index) => {
        console.log(`  Violation ${index + 1}: ${chunk.tokens} tokens (limit: ${options.maxTokens})`);
        console.log(`    Chunk ID: ${chunk.id}`);
        console.log(`    Section: ${chunk.metadata?.sectionTitle}`);
      });
    }

    // This test expects NO violations
    chunks.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `Chunk ${index + 1} exceeds maxTokens: ${chunk.tokens} > ${options.maxTokens}`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });

  it('should identify which pipeline stage causes maxTokens violations', async () => {
    // Test each stage individually to find where the violation occurs
    const { parseMarkdown } = await import('../lib/parse-markdown');
    const { flattenAst } = await import('../lib/flatten-ast');
    const { packNodes } = await import('../lib/packer');
    const { addOverlap } = await import('../lib/overlap');
    const { normalizeChunks } = await import('../lib/normalize');
    const { attachMetadata } = await import('../lib/metadata');
    const { addEmbedText } = await import('../lib/embed-text');

    const content = `# Large Section

This is a section that will be large enough to potentially cause maxTokens violations after processing. ${'Adding more content to make it substantial. '.repeat(20)}

## Subsection

More content that could push us over the limit. ${'Extra text to ensure we hit the limits. '.repeat(15)}`;

    const options: ChunkOptions = {
      maxTokens: 200,
      minTokens: 50,
      targetTokens: 150,
      overlapSentences: 2,
      strictMode: false,
      breadcrumbMode: 'conditional'
    };

    console.log('\nDEBUG: Pipeline stage analysis:');

    // Stage 1: Parse and flatten
    const ast = parseMarkdown(content);
    const nodes = flattenAst(ast);
    console.log(`  After flatten: ${nodes.length} nodes`);

    // Stage 2: Pack
    const packed = packNodes(nodes, options);
    console.log(`  After pack: ${packed.length} chunks`);
    packed.forEach((chunk, i) => {
      console.log(`    Pack chunk ${i + 1}: ${chunk.tokens} tokens`);
    });

    // Stage 3: Add overlap
    const overlapped = addOverlap(packed, options);
    console.log(`  After overlap: ${overlapped.length} chunks`);
    overlapped.forEach((chunk, i) => {
      console.log(`    Overlap chunk ${i + 1}: ${chunk.tokens} tokens`);
    });

    // Stage 4: Normalize
    const normalized = normalizeChunks(overlapped);
    console.log(`  After normalize: ${normalized.length} chunks`);
    normalized.forEach((chunk, i) => {
      console.log(`    Normalize chunk ${i + 1}: ${chunk.tokens} tokens`);
    });

    // Stage 5: Add metadata
    const withMetadata = attachMetadata(normalized, options, 'test.md');
    console.log(`  After metadata: ${withMetadata.length} chunks`);
    withMetadata.forEach((chunk, i) => {
      console.log(`    Metadata chunk ${i + 1}: ${chunk.tokens} tokens`);
    });

    // Stage 6: Add embed text
    const final = addEmbedText(withMetadata, options.breadcrumbMode, options.minTokens);
    console.log(`  After embed text: ${final.length} chunks`);
    final.forEach((chunk, i) => {
      console.log(`    Final chunk ${i + 1}: ${chunk.tokens} tokens`);
    });

    // Check which stage first violates maxTokens
    const stages = [
      { name: 'packed', chunks: packed },
      { name: 'overlapped', chunks: overlapped },
      { name: 'normalized', chunks: normalized },
      { name: 'withMetadata', chunks: withMetadata },
      { name: 'final', chunks: final }
    ];

    stages.forEach(stage => {
      const violations = stage.chunks.filter(chunk => (chunk.tokens || 0) > options.maxTokens);
      if (violations.length > 0) {
        console.log(`  VIOLATION FIRST OCCURS AT: ${stage.name} stage`);
        console.log(`    ${violations.length} chunks exceed maxTokens`);
      }
    });

    // Final assertion
    final.forEach((chunk, index) => {
      expect(chunk.tokens || 0,
        `Final chunk ${index + 1} exceeds maxTokens at final stage`
      ).toBeLessThanOrEqual(options.maxTokens);
    });
  });
});