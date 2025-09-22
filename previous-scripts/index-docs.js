#!/usr/bin/env node

import { config } from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
config();
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { OpenAIEmbeddings } from '@langchain/openai';
import { adaptiveChunkDocuments } from './lib/hierarchical-chunker.js';
import { Document } from 'langchain/document';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../docs');
const VECTOR_STORE_DIR = path.join(__dirname, '../vector-store');

// Configuration for hierarchical chunker
const CHUNK_CONFIG = {
  maxTokens: 400,
  minTokens: 200,
  overlapSentences: 1,
  structure: 'markdown'
};

async function loadDocuments() {
  console.log('📚 Loading documentation files...');
  const documents = [];

  try {
    const files = await fs.readdir(DOCS_DIR);
    const txtFiles = files.filter(f => f.endsWith('.txt'));

    for (const file of txtFiles) {
      const filePath = path.join(DOCS_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const source = path.basename(file, '.txt');

      // Create document with metadata
      const doc = new Document({
        pageContent: content,
        metadata: {
          source: source,
          fileName: file,
          timestamp: new Date().toISOString()
        }
      });

      documents.push(doc);
      console.log(`  ✓ Loaded ${source}.txt (${(content.length / 1024).toFixed(1)}KB)`);
    }

    return documents;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

async function splitDocuments(documents) {
  console.log('\n✂️  Splitting documents into chunks with hierarchical chunker...');

  const splitDocs = adaptiveChunkDocuments(documents, CHUNK_CONFIG);
  console.log(`  ✓ Created ${splitDocs.length} chunks using hierarchical splitting`);

  // Hierarchical chunker produces high-quality chunks, minimal filtering needed
  const qualityChunks = splitDocs.filter(doc => {
    const content = doc.pageContent.trim();
    return content.length > 10; // Only filter truly empty chunks
  });

  const removed = splitDocs.length - qualityChunks.length;
  if (removed > 0) {
    console.log(`  ✓ Filtered to ${qualityChunks.length} quality chunks (removed ${removed} empty chunks)`);
  }

  // Show token statistics
  const tokenCounts = qualityChunks.map(doc => doc.metadata.chunkTokens);
  const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
  const minTokens = Math.min(...tokenCounts);
  const maxTokens = Math.max(...tokenCounts);
  console.log(`  📊 Token distribution: avg=${avgTokens.toFixed(1)}, min=${minTokens}, max=${maxTokens}`);

  return qualityChunks;
}

async function createVectorStore(documents) {
  console.log('\n🔮 Creating vector embeddings...');
  console.log('  ℹ️  Using local HNSWLib vector store (no external DB required)');

  try {
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.log('\n⚠️  No OPENAI_API_KEY found in environment');
      console.log('  For OpenAI embeddings, set your API key:');
      console.log('  export OPENAI_API_KEY="your-key-here"\n');
      console.log('  Alternatively, you can use free local embeddings.');
      console.log('  Would you like to use local embeddings instead? (no API key required)\n');

      // For now, we'll create a simple fallback
      throw new Error('Please set OPENAI_API_KEY or use local embeddings');
    }

    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small'
    });

    // Create vector store from documents
    const vectorStore = await HNSWLib.fromDocuments(documents, embeddings);

    // Save the vector store to disk
    await vectorStore.save(VECTOR_STORE_DIR);
    console.log(`  ✓ Vector store saved to ${VECTOR_STORE_DIR}`);

    return vectorStore;
  } catch (error) {
    console.error('Error creating vector store:', error);
    throw error;
  }
}

async function testSearch(vectorStore) {
  console.log('\n🔍 Testing vector search...');

  const testQueries = [
    'How do I create a Svelte component?',
    'What are Skeleton UI components?',
    'How to use Tailwind CSS?'
  ];

  for (const query of testQueries) {
    console.log(`\n  Query: "${query}"`);
    const results = await vectorStore.similaritySearch(query, 2);

    for (const result of results) {
      console.log(`    📄 ${result.metadata.source}: ${result.pageContent.substring(0, 100)}...`);
    }
  }
}

async function main() {
  console.log('🚀 Document Indexing System\n');

  try {
    // Load documents
    const documents = await loadDocuments();

    if (documents.length === 0) {
      console.log('\n⚠️  No documents found in docs directory.');
      console.log('  Run ./scripts/update-docs.sh first to download documentation.');
      return;
    }

    // Split documents into chunks
    const splitDocs = await splitDocuments(documents);

    // Create vector store
    const vectorStore = await createVectorStore(splitDocs);

    // Test the search
    await testSearch(vectorStore);

    console.log('\n✅ Documentation indexed successfully!');
    console.log('  Vector store is ready for semantic search.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();