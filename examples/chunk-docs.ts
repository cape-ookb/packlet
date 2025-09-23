#!/usr/bin/env tsx

/**
 * chunk-docs.ts
 *
 * Loads a markdown file from the docs directory, chunks it using the chunker,
 * and saves each chunk as an individual JSON file in the chunks directory.
 *
 * Usage:
 *   npx tsx examples/chunk-docs.ts strategy.md
 *   npx tsx examples/chunk-docs.ts flatten-ast.md
 *
 * Output:
 *   chunks/doc_strategy__ch0.json
 *   chunks/doc_strategy__ch1.json
 *   chunks/doc_flatten-ast__ch0.json
 *   etc.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import { chunkMarkdown } from '../lib/index';
import { ChunkOptions } from '../lib/types';

function main() {
  const filename = process.argv[2];

  if (!filename) {
    console.error('Usage: npx tsx examples/chunk-docs.ts <filename>');
    console.error('Example: npx tsx examples/chunk-docs.ts strategy.md');
    process.exit(1);
  }

  try {
    // Load the file from docs directory
    const docsPath = join('docs', filename);
    console.log(`Loading: ${docsPath}`);

    const content = readFileSync(docsPath, 'utf-8');
    console.log(`File loaded: ${content.length} characters`);

    // Chunk the document with reasonable options for documentation
    const options: ChunkOptions = {
      minTokens: 200,
      maxTokens: 800,
      targetTokens: 600,
      overlapSentences: 2,
      strictMode: false
    };

    // Prepare document name and metadata
    const docName = basename(filename, extname(filename));

    console.log('Chunking document...');
    const startTime = Date.now();
    const result = chunkMarkdown(content, docName, options);
    const endTime = Date.now();
    const contentType = 'doc'; // Could be made configurable: doc, api, guide, etc.
    const processedAt = new Date().toISOString();
    const processingTimeMs = endTime - startTime;

    // Save each chunk as individual file
    const chunkFiles: string[] = [];

    result.chunks.forEach((chunk, index) => {
      const chunkId = `${contentType}:${docName}::ch${index}`;
      const parentId = `${contentType}:${docName}`;
      const prevId = index > 0 ? `${contentType}:${docName}::ch${index - 1}` : null;
      const nextId = index < result.chunks.length - 1 ? `${contentType}:${docName}::ch${index + 1}` : null;

      // Calculate character offsets (approximate)
      const charStart = index * Math.floor(content.length / result.chunks.length);
      const charEnd = (index + 1) * Math.floor(content.length / result.chunks.length);

      // Extract heading information from chunk metadata
      const heading = chunk.metadata?.heading || '';
      const headerPath = chunk.metadata?.headerPath || [];
      const headerHierarchy = headerPath.join(' > ');

      const chunkData = {
        id: chunkId,
        parentId: parentId,
        prevId: prevId,
        nextId: nextId,
        embedText: (chunk.originalText || chunk.content || '').trim(),
        originalText: (chunk.originalText || chunk.content || '').trim(),
        chunkNumber: index,
        contentType: contentType,
        heading: heading,
        headerPath: headerPath,
        headerHierarchy: headerHierarchy,
        sourcePosition: {
          charStart: charStart,
          charEnd: Math.min(charEnd, content.length),
          totalChars: (chunk.originalText || chunk.content || '').length
        },
        tokenStats: {
          tokens: chunk.tokenStats?.tokens || chunk.tokens || 0,
          estimatedTokens: Math.ceil((chunk.originalText || chunk.content || '').length / 3.8)
        },
        metadata: {
          sourceFile: filename,
          processedAt: processedAt,
          chunkingOptions: options,
          pipeline: {
            version: '1.0.0',
            processingTimeMs: processingTimeMs
          }
        }
      };

      const chunkFilename = `${contentType}_${docName}__ch${index}.json`;
      const chunkPath = join('chunks', chunkFilename);

      writeFileSync(chunkPath, JSON.stringify(chunkData, null, 2));
      chunkFiles.push(chunkFilename);
    });

    // Print summary
    console.log('\n✅ Chunking completed successfully!');
    console.log(`📊 Stats:`);
    console.log(`   - Source: ${filename} (${content.length} chars)`);
    console.log(`   - Chunks: ${result.chunks.length}`);
    console.log(`   - Total tokens: ${result.stats.totalTokens}`);
    console.log(`   - Avg tokens/chunk: ${result.stats.avgTokens}`);
    console.log(`   - Token range: ${result.stats.minTokens}-${result.stats.maxTokens}`);
    console.log(`   - Processing time: ${result.stats.processingTime}`);
    console.log(`   - Quality flag: ${result.stats.qualityFlag ? '⚠️' : '✅'}`);
    console.log(`💾 Output files created:`);
    chunkFiles.forEach(file => console.log(`   - chunks/${file}`));

    if (result.stats.qualityFlag) {
      console.log('\n⚠️  Quality flag raised - check chunk distribution and consider adjusting options');
    }

  } catch (error) {
    console.error('❌ Error:', (error as Error).message);

    if ((error as any).code === 'ENOENT') {
      console.error(`\nFile not found: ${filename}`);
      console.error('Available files in docs/:');
      try {
        const files = readdirSync('docs').filter(f => f.endsWith('.md'));
        files.forEach(file => console.error(`  - ${file}`));
      } catch (e) {
        console.error('  (unable to list docs directory)');
      }
    }

    process.exit(1);
  }
}

main();