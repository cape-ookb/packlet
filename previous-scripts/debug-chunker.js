#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../docs');

// Configuration
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

class DebugRecursiveCharacterTextSplitter extends RecursiveCharacterTextSplitter {
  splitText(text) {
    console.log(`\n🔍 DEBUG: Splitting text of length ${text.length}`);
    console.log(`First 100 chars: "${text.substring(0, 100)}..."`);

    const result = super.splitText(text);

    console.log(`📊 Split result: ${result.length} chunks`);
    result.forEach((chunk, i) => {
      const trimmed = chunk.trim();
      console.log(`  Chunk ${i}: ${trimmed.length} chars - "${trimmed.substring(0, 50)}${trimmed.length > 50 ? '...' : ''}"`);

      // Flag suspicious chunks
      if (trimmed.length < 50) {
        console.log(`    ⚠️  SHORT CHUNK!`);
      }
      if (/^-+$/.test(trimmed)) {
        console.log(`    ⚠️  DASH-ONLY CHUNK!`);
      }
      if (/^#+\s*$/.test(trimmed)) {
        console.log(`    ⚠️  EMPTY HEADER CHUNK!`);
      }
    });

    return result;
  }

  _splitText(text, separators) {
    console.log(`\n🔄 _splitText called with ${separators.length} separators`);
    console.log(`Text length: ${text.length}`);
    console.log(`Separators: [${separators.map(s => JSON.stringify(s)).join(', ')}]`);

    // Call the parent method
    const result = super._splitText(text, separators);

    console.log(`_splitText result: ${result.length} chunks`);

    return result;
  }
}

async function debugSingleFile() {
  const fileName = process.argv[2];
  if (!fileName) {
    console.log('Usage: node debug-chunker.js <filename>');
    console.log('Example: node debug-chunker.js skeleton.txt');
    return;
  }

  const filePath = path.join(DOCS_DIR, fileName);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    console.log(`📄 Loading ${fileName}`);
    console.log(`File size: ${content.length} characters`);
    console.log(`First 200 chars:\n"${content.substring(0, 200)}..."`);

    // Show where separators appear in the content
    const separators = [
      "\n---\n",
      "\n# ",
      "\n## ",
      "\n### ",
      "\n#### ",
      "\n##### ",
      "\n###### ",
      "\n\n",
      "\n",
      ". ",
      "! ",
      "? ",
      " ",
      ""
    ];

    console.log('\n🔍 Separator analysis:');
    separators.forEach(sep => {
      if (sep === "") return; // Skip empty
      const count = (content.match(new RegExp(sep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      if (count > 0) {
        console.log(`  "${JSON.stringify(sep)}": ${count} occurrences`);
      }
    });

    // Debug the splitting process
    const splitter = new DebugRecursiveCharacterTextSplitter({
      chunkSize: CHUNK_SIZE,
      chunkOverlap: CHUNK_OVERLAP,
      separators,
      keepSeparator: true
    });

    console.log('\n🚀 Starting chunking process...');
    const chunks = splitter.splitText(content);

    console.log('\n📈 Final Analysis:');
    console.log(`Total chunks: ${chunks.length}`);

    const shortChunks = chunks.filter(c => c.trim().length < 50);
    const dashOnlyChunks = chunks.filter(c => /^-+$/.test(c.trim()));
    const emptyHeaderChunks = chunks.filter(c => /^#+\s*$/.test(c.trim()));

    console.log(`Short chunks (< 50 chars): ${shortChunks.length}`);
    console.log(`Dash-only chunks: ${dashOnlyChunks.length}`);
    console.log(`Empty header chunks: ${emptyHeaderChunks.length}`);

    if (shortChunks.length > 0) {
      console.log('\n⚠️  SHORT CHUNKS:');
      shortChunks.forEach((chunk, i) => {
        console.log(`  ${i + 1}. "${chunk.trim()}" (${chunk.trim().length} chars)`);
      });
    }

    if (dashOnlyChunks.length > 0) {
      console.log('\n⚠️  DASH-ONLY CHUNKS:');
      dashOnlyChunks.forEach((chunk, i) => {
        console.log(`  ${i + 1}. "${chunk.trim()}"`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSingleFile();