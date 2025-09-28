#!/usr/bin/env tsx

/**
 * analyze-chunks.ts
 *
 * CLI tool for analyzing how documents are chunked.
 * Provides visual representation, statistics, and detailed chunk analysis.
 *
 * Usage:
 *   npx tsx examples/analyze-chunks.ts <file.md> [options]
 *   npx tsx examples/analyze-chunks.ts docs/overlap.md --visual --stats
 */

import { readFileSync } from 'fs';
import { chunkMarkdown } from '../lib/index';
import { ChunkOptions } from '../lib/types';

interface AnalysisOptions {
  visual?: boolean;
  stats?: boolean;
  verbose?: boolean;
  maxTokens?: number;
  minTokens?: number;
  overlapSentences?: number;
}

function parseArgs(): { filePath: string; options: AnalysisOptions } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx examples/analyze-chunks.ts <file.md> [--visual] [--stats] [--verbose]');
    process.exit(1);
  }

  const filePath = args[0];
  const options: AnalysisOptions = {
    visual: args.includes('--visual'),
    stats: args.includes('--stats'),
    verbose: args.includes('--verbose'),
  };

  // Parse token options
  const maxTokensIndex = args.indexOf('--max-tokens');
  if (maxTokensIndex >= 0 && args[maxTokensIndex + 1]) {
    options.maxTokens = parseInt(args[maxTokensIndex + 1]);
  }

  const minTokensIndex = args.indexOf('--min-tokens');
  if (minTokensIndex >= 0 && args[minTokensIndex + 1]) {
    options.minTokens = parseInt(args[minTokensIndex + 1]);
  }

  const overlapIndex = args.indexOf('--overlap');
  if (overlapIndex >= 0 && args[overlapIndex + 1]) {
    options.overlapSentences = parseInt(args[overlapIndex + 1]);
  }

  return { filePath, options };
}

function createVisualSeparator(length: number, char: string = '─'): string {
  return char.repeat(length);
}

function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

function displayChunkVisual(chunks: any[], options: AnalysisOptions): void {
  console.log('\n' + '='.repeat(80));
  console.log('📊 VISUAL CHUNK ANALYSIS');
  console.log('='.repeat(80));

  chunks.forEach((chunk, index) => {
    const isFirst = index === 0;
    const isLast = index === chunks.length - 1;

    // Chunk header
    const chunkHeader = `🔸 CHUNK ${index + 1}/${chunks.length}`;
    const tokenInfo = `${chunk.tokens} tokens`;
    const sizeBar = '█'.repeat(Math.min(50, Math.round(chunk.tokens / 10)));

    console.log('\n┌' + createVisualSeparator(78) + '┐');
    console.log(`│ ${chunkHeader.padEnd(25)} │ ${tokenInfo.padEnd(15)} │ ${sizeBar.padEnd(35)} │`);
    console.log('├' + createVisualSeparator(78) + '┤');

    // Metadata
    const metadata = chunk.metadata || {};
    const headerPath = metadata.headerPath || [];
    const nodeTypes = metadata.nodeTypes || [];

    if (headerPath.length > 0) {
      const breadcrumb = headerPath.join(' > ');
      console.log(`│ 📍 Section: ${truncateText(breadcrumb, 65).padEnd(65)} │`);
    }

    if (nodeTypes.length > 0) {
      const types = nodeTypes.join(', ');
      console.log(`│ 🏷️  Types: ${types.padEnd(67)} │`);
    }

    // Content preview
    const content = chunk.originalText || chunk.content || '';
    const lines = content.split('\n').slice(0, 5); // First 5 lines

    console.log('├' + createVisualSeparator(78) + '┤');
    lines.forEach(line => {
      const displayLine = truncateText(line.trim(), 76);
      console.log(`│ ${displayLine.padEnd(76)} │`);
    });

    if (content.split('\n').length > 5) {
      console.log(`│ ${'... (truncated)'.padEnd(76)} │`);
    }

    console.log('└' + createVisualSeparator(78) + '┘');

    // Show overlap if not the last chunk
    if (!isLast && options.verbose) {
      console.log('   ↓ OVERLAP ↓');
    }
  });
}

function displayChunkList(chunks: any[], options: AnalysisOptions): void {
  console.log('\n' + '='.repeat(80));
  console.log('📝 CHUNK BREAKDOWN');
  console.log('='.repeat(80));

  chunks.forEach((chunk, index) => {
    console.log(`\n--- CHUNK ${index + 1} ---`);
    console.log(`📊 Tokens: ${chunk.tokens}`);

    const metadata = chunk.metadata || {};
    if (metadata.headerPath?.length > 0) {
      console.log(`📍 Path: ${metadata.headerPath.join(' > ')}`);
    }
    if (metadata.nodeTypes?.length > 0) {
      console.log(`🏷️  Types: ${metadata.nodeTypes.join(', ')}`);
    }
    if (metadata.sectionTitle) {
      console.log(`📰 Section: ${metadata.sectionTitle}`);
    }

    // Content preview
    const content = chunk.originalText || chunk.content || '';
    const preview = truncateText(content.replace(/\n/g, ' '), 200);
    console.log(`📄 Preview: ${preview}`);

    if (options.verbose) {
      console.log(`🆔 ID: ${chunk.id || 'N/A'}`);
      if (chunk.embedText && chunk.embedText !== content) {
        const embedPreview = truncateText(chunk.embedText.replace(/\n/g, ' '), 150);
        console.log(`🔗 Embed: ${embedPreview}`);
      }
    }
  });
}

function displayStatistics(chunks: any[], stats: any, options: AnalysisOptions): void {
  console.log('\n' + '='.repeat(80));
  console.log('📈 STATISTICS SUMMARY');
  console.log('='.repeat(80));

  const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokens, 0);
  const avgTokens = Math.round(totalTokens / chunks.length);
  const minTokens = Math.min(...chunks.map(c => c.tokens));
  const maxTokens = Math.max(...chunks.map(c => c.tokens));

  console.log(`📊 Total Chunks: ${chunks.length}`);
  console.log(`🎯 Total Tokens: ${totalTokens}`);
  console.log(`📐 Average Size: ${avgTokens} tokens`);
  console.log(`📉 Min Size: ${minTokens} tokens`);
  console.log(`📈 Max Size: ${maxTokens} tokens`);
  console.log(`⚡ Processing Time: ${stats.processingTimeMs}ms`);

  // Token distribution
  const distribution = {
    small: chunks.filter(c => c.tokens < 200).length,
    medium: chunks.filter(c => c.tokens >= 200 && c.tokens < 400).length,
    large: chunks.filter(c => c.tokens >= 400).length,
  };

  console.log('\n📊 Token Distribution:');
  console.log(`   Small (<200): ${distribution.small} chunks`);
  console.log(`   Medium (200-399): ${distribution.medium} chunks`);
  console.log(`   Large (400+): ${distribution.large} chunks`);

  // Section analysis
  const sections = new Set(chunks.map(c => c.metadata?.sectionTitle).filter(Boolean));
  console.log(`\n📚 Sections: ${sections.size} unique sections`);

  // Node type analysis
  const allNodeTypes = chunks.flatMap(c => c.metadata?.nodeTypes || []);
  const nodeTypeCounts = allNodeTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n🏷️  Content Types:');
  Object.entries(nodeTypeCounts)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count} occurrences`);
    });
}

function main(): void {
  const { filePath, options } = parseArgs();

  try {
    // Read file
    const content = readFileSync(filePath, 'utf-8');
    const fileName = filePath.split('/').pop() || 'document';

    // Configure chunking options
    const chunkOptions: ChunkOptions = {
      maxTokens: options.maxTokens || 512,
      minTokens: options.minTokens || 64,
      overlapSentences: options.overlapSentences || 2,
      breadcrumbMode: 'conditional',
      strictMode: true,
    };

    console.log('🔍 ANALYZING DOCUMENT CHUNKING');
    console.log(`📄 File: ${filePath}`);
    console.log(`⚙️  Config: max=${chunkOptions.maxTokens}, min=${chunkOptions.minTokens}, overlap=${chunkOptions.overlapSentences}`);

    // Process document
    const result = chunkMarkdown(content, fileName, chunkOptions);
    const { chunks, stats } = result;

    // Display results based on options
    if (options.visual || (!options.stats && !options.verbose)) {
      displayChunkVisual(chunks, options);
    }

    if (!options.visual || options.verbose) {
      displayChunkList(chunks, options);
    }

    if (options.stats || options.verbose) {
      displayStatistics(chunks, stats, options);
    }

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Execute main function when run directly
main();