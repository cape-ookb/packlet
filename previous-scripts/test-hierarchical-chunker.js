#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adaptiveChunk } from './lib/hierarchical-chunker.js';
import { TokenTextSplitter } from 'langchain/text_splitter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../docs');

async function testHierarchicalChunker() {
  const fileName = process.argv[2] || 'skeleton.txt';
  const filePath = path.join(DOCS_DIR, fileName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`📄 Testing hierarchical chunker on ${fileName}`);
    console.log(`File size: ${content.length} characters\n`);

    // Test 1: New hierarchical chunker
    console.log('=== Hierarchical Adaptive Chunker ===');
    const hierarchicalChunks = adaptiveChunk(content, {
      maxTokens: 400,
      minTokens: 200,
      overlapSentences: 1,
      structure: 'markdown'
    });

    console.log(`Generated ${hierarchicalChunks.length} chunks`);

    // Analyze token distribution
    const tokenCounts = hierarchicalChunks.map(c => c.nTokens);
    const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
    const minTokensFound = Math.min(...tokenCounts);
    const maxTokensFound = Math.max(...tokenCounts);

    console.log(`Token distribution: avg=${avgTokens.toFixed(1)}, min=${minTokensFound}, max=${maxTokensFound}`);

    // Count problematic chunks
    const problems = hierarchicalChunks.filter(chunk => {
      const content = chunk.text.trim();
      return content.length < 50 ||
             /^-+$/.test(content) ||
             /^#+\s*$/.test(content) ||
             /^\s*[`*_-]+\s*$/.test(content);
    });
    console.log(`Problematic chunks: ${problems.length}`);

    // Test 2: Compare with LangChain TokenTextSplitter
    console.log('\n=== LangChain TokenTextSplitter (for comparison) ===');
    const tokenSplitter = new TokenTextSplitter({
      chunkSize: 400,
      chunkOverlap: 50,
      encodingName: 'gpt2'
    });

    const langchainChunks = await tokenSplitter.splitText(content);
    console.log(`Generated ${langchainChunks.length} chunks`);

    const langchainProblems = langchainChunks.filter(chunk => {
      const content = chunk.trim();
      return content.length < 50 ||
             /^-+$/.test(content) ||
             /^#+\s*$/.test(content) ||
             /^\s*[`*_-]+\s*$/.test(content);
    });
    console.log(`Problematic chunks: ${langchainProblems.length}`);

    // Show sample chunks
    console.log('\n✅ Sample hierarchical chunks:');
    hierarchicalChunks.slice(0, 3).forEach((chunk, i) => {
      console.log(`  ${i + 1}. (${chunk.nTokens} tokens) "${chunk.text.substring(0, 80)}..."`);
    });

    console.log('\n📊 Summary Comparison:');
    console.log(`  Hierarchical:   ${hierarchicalChunks.length} chunks, ${problems.length} problems, ${avgTokens.toFixed(1)} avg tokens`);
    console.log(`  LangChain:      ${langchainChunks.length} chunks, ${langchainProblems.length} problems`);

    // Test chunk quality by examining structure preservation
    console.log('\n🔍 Structure Analysis:');
    const withHeaders = hierarchicalChunks.filter(c => /^#+\s/.test(c.text.trim()));
    const withCodeBlocks = hierarchicalChunks.filter(c => /```/.test(c.text));
    console.log(`  Chunks starting with headers: ${withHeaders.length}`);
    console.log(`  Chunks containing code blocks: ${withCodeBlocks.length}`);

    // Show a few problematic chunks if any exist
    if (problems.length > 0) {
      console.log('\n⚠️  Sample problematic chunks:');
      problems.slice(0, 3).forEach((chunk, i) => {
        console.log(`  ${i + 1}. (${chunk.nTokens} tokens) "${chunk.text}"`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testHierarchicalChunker();