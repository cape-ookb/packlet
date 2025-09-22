#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adaptiveChunk } from './lib/hierarchical-chunker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../docs');

async function simpleDebug() {
  const fileName = process.argv[2] || 'skeleton.txt';
  const filePath = path.join(DOCS_DIR, fileName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`📄 Analyzing ${fileName}`);
    console.log(`File size: ${content.length} characters`);

    // Test with hierarchical chunker
    console.log('\n🚀 Chunking with hierarchical chunker...');
    const chunks = adaptiveChunk(content, {
      maxTokens: 400,
      minTokens: 200,
      overlapSentences: 1,
      structure: 'markdown'
    });

    console.log(`📊 Generated ${chunks.length} chunks`);

    // Analyze problematic chunks
    const problems = [];
    chunks.forEach((chunk, i) => {
      const trimmed = chunk.text.trim();

      if (trimmed.length < 50) {
        problems.push({ index: i, type: 'SHORT', content: trimmed, length: trimmed.length, tokens: chunk.nTokens });
      }
      if (/^-+$/.test(trimmed)) {
        problems.push({ index: i, type: 'DASHES', content: trimmed, length: trimmed.length, tokens: chunk.nTokens });
      }
      if (/^#+\s*$/.test(trimmed)) {
        problems.push({ index: i, type: 'EMPTY_HEADER', content: trimmed, length: trimmed.length, tokens: chunk.nTokens });
      }
      if (/^\s*[`*_-]+\s*$/.test(trimmed)) {
        problems.push({ index: i, type: 'FORMATTING', content: trimmed, length: trimmed.length, tokens: chunk.nTokens });
      }
    });

    console.log(`\n⚠️  Found ${problems.length} problematic chunks:`);
    problems.forEach(p => {
      console.log(`  ${p.type}: Chunk ${p.index} (${p.length} chars, ${p.tokens} tokens) - "${p.content}"`);
    });

    // Show token distribution
    const tokenCounts = chunks.map(c => c.nTokens);
    const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
    const minTokens = Math.min(...tokenCounts);
    const maxTokens = Math.max(...tokenCounts);
    console.log(`\n📊 Token distribution: avg=${avgTokens.toFixed(1)}, min=${minTokens}, max=${maxTokens}`);

    // Show some good chunks for comparison
    const goodChunks = chunks.filter(c => c.text.trim().length >= 50).slice(0, 3);
    console.log(`\n✅ Sample good chunks:`);
    goodChunks.forEach((chunk, i) => {
      console.log(`  ${i + 1}. (${chunk.nTokens} tokens) "${chunk.text.trim().substring(0, 80)}..."`);
    });

    // Show structure analysis
    console.log('\n🔍 Structure Analysis:');
    const withHeaders = chunks.filter(c => /^#+\s/.test(c.text.trim()));
    const withCodeBlocks = chunks.filter(c => /```/.test(c.text));
    console.log(`  Chunks starting with headers: ${withHeaders.length}`);
    console.log(`  Chunks containing code blocks: ${withCodeBlocks.length}`);

    console.log(`\n📈 Summary:`);
    console.log(`  Hierarchical chunker: ${chunks.length} chunks, ${problems.length} problems, ${avgTokens.toFixed(1)} avg tokens`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

simpleDebug();