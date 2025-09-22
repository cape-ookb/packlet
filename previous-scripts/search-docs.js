#!/usr/bin/env node

import { config } from 'dotenv';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';

// Load environment variables from .env file
config();
import { OpenAIEmbeddings } from '@langchain/openai';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VECTOR_STORE_DIR = path.join(__dirname, '../vector-store');

async function searchDocs(query, numResults = 5) {
  try {
    // Check if vector store exists
    const embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small'
    });

    // Load the vector store
    const vectorStore = await HNSWLib.load(VECTOR_STORE_DIR, embeddings);

    // Perform search
    const results = await vectorStore.similaritySearch(query, numResults);

    console.log(`🔍 Search results for: "${query}"\n`);

    results.forEach((result, index) => {
      console.log(`${index + 1}. 📄 ${result.metadata.source.toUpperCase()}`);
      console.log(`   ${result.pageContent.substring(0, 200).replace(/\n/g, ' ')}...`);
      console.log('');
    });

    return results;
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.log('Usage: node scripts/search-docs.js "your search query"');
    console.log('\nExamples:');
    console.log('  node scripts/search-docs.js "Svelte components"');
    console.log('  node scripts/search-docs.js "Skeleton UI buttons"');
    console.log('  node scripts/search-docs.js "Tailwind CSS grid"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️  Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  try {
    await searchDocs(query);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nMake sure to run ./scripts/index-docs.js first to create the vector store.');
    process.exit(1);
  }
}

main();