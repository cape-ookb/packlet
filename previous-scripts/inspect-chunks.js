#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { adaptiveChunkDocuments } from './lib/hierarchical-chunker.js';
import { Document } from 'langchain/document';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.join(__dirname, '../docs');
const CHUNKS_DIR = path.join(__dirname, '../chunks');

// Configuration for hierarchical chunker
const CHUNK_CONFIG = {
  maxTokens: 400,
  minTokens: 200,
  overlapSentences: 1,
  structure: 'markdown'
};
const MIN_CHUNK_LENGTH = 50;

async function loadDocument(fileName) {
  console.log(`📚 Loading ${fileName}...`);

  try {
    const filePath = path.join(DOCS_DIR, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    const source = path.basename(fileName, '.txt');

    // Create document with metadata
    const doc = new Document({
      pageContent: content,
      metadata: {
        source: source,
        fileName: fileName,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`  ✓ Loaded ${source}.txt (${(content.length / 1024).toFixed(1)}KB)`);
    return doc;
  } catch (error) {
    console.error(`Error loading ${fileName}:`, error);
    throw error;
  }
}

async function loadAllDocuments() {
  console.log('📚 Loading all documentation files...');
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

  // Enhanced chunks with relationships
  const enhancedChunks = [];

  // Group by source document
  const chunksBySource = {};
  splitDocs.forEach((doc, index) => {
    const source = doc.metadata.source;
    if (!chunksBySource[source]) {
      chunksBySource[source] = [];
    }
    chunksBySource[source].push({ ...doc, originalIndex: index });
  });

  // Process each source separately to build relationships
  for (const [source, sourceChunks] of Object.entries(chunksBySource)) {
    const originalDoc = documents.find(d => d.metadata.source === source);
    const fullContent = originalDoc.pageContent;

function extractHeadersFromContent(content) {
  const headers = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      headers.push({
        level: headerMatch[1].length,
        text: headerMatch[2],
        line: i,
        fullText: line
      });
    }
  }

  return headers;
}

function getHeaderHierarchy(chunkText, fullContent) {
  // Find chunk position in full content
  const chunkStart = fullContent.indexOf(chunkText.trim());
  if (chunkStart === -1) return { headerPath: [], hierarchy: '' };

  // Get all headers from full content
  const allHeaders = extractHeadersFromContent(fullContent);

  // Find headers that come before this chunk
  const contentBeforeChunk = fullContent.substring(0, chunkStart);
  const linesBeforeChunk = contentBeforeChunk.split('\n').length;

  const relevantHeaders = allHeaders.filter(header => header.line < linesBeforeChunk);

  // Build header hierarchy (keep only the most recent header of each level)
  const headerStack = [];
  for (const header of relevantHeaders) {
    // Remove headers of same or deeper level
    while (headerStack.length > 0 && headerStack[headerStack.length - 1].level >= header.level) {
      headerStack.pop();
    }
    headerStack.push(header);
  }

  // Check if chunk itself starts with a header
  const chunkHeaders = extractHeadersFromContent(chunkText);
  if (chunkHeaders.length > 0) {
    const firstChunkHeader = chunkHeaders[0];
    // Add the chunk's own header if it's more specific than the current hierarchy
    if (headerStack.length === 0 || firstChunkHeader.level > headerStack[headerStack.length - 1].level) {
      headerStack.push({
        level: firstChunkHeader.level,
        text: firstChunkHeader.text,
        fullText: firstChunkHeader.fullText
      });
    }
  }

  return {
    headerPath: headerStack.map(h => h.fullText),
    hierarchy: headerStack.map(h => h.text).join(' > ')
  };
}

function isLowQualityChunk(content) {
  const trimmed = content.trim();

  // Skip very short chunks
  if (trimmed.length < MIN_CHUNK_LENGTH) {
    return true;
  }

  // Skip chunks that are only separators, whitespace, or markdown syntax
  const lowQualityPatterns = [
    /^-+$/,                    // Only dashes (horizontal rules)
    /^=+$/,                    // Only equals signs
    /^#+\s*$/,                 // Only hash symbols (empty headers)
    /^\s*[`*_-]+\s*$/,         // Only markdown formatting chars
    /^```[\s\S]*```$/,         // Empty code blocks
    /^\s*\|\s*\|\s*$/,         // Empty table rows
    /^\s*>\s*$/,               // Empty blockquotes
    /^\s*\d+\.\s*$/,           // Only numbered list items with no content
    /^\s*[-*+]\s*$/            // Only bullet points with no content
  ];

  for (const pattern of lowQualityPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  // Skip chunks with very low content-to-markup ratio
  const contentWords = trimmed.replace(/[#*_`>\-=|]/g, '').trim().split(/\s+/).filter(w => w.length > 0);
  if (contentWords.length < 3) {
    return true;
  }

  return false;
}

function calculateCharOffsets(chunkContent, fullContent) {
  if (!fullContent || !chunkContent) {
    return {
      charStart: -1,
      charEnd: -1,
      sourceLength: fullContent ? fullContent.length : 0,
      confidence: 0.0
    };
  }

  const chunkStripped = chunkContent.trim();

  // Try exact match first
  const charStart = fullContent.indexOf(chunkStripped);
  if (charStart !== -1) {
    return {
      charStart,
      charEnd: charStart + chunkStripped.length,
      sourceLength: fullContent.length,
      confidence: 1.0
    };
  }

  // Fallback: try first 100 characters
  const searchPortion = chunkStripped.substring(0, 100);
  const partialStart = fullContent.indexOf(searchPortion);
  if (partialStart !== -1) {
    return {
      charStart: partialStart,
      charEnd: Math.min(partialStart + chunkStripped.length, fullContent.length),
      sourceLength: fullContent.length,
      confidence: 0.8
    };
  }

  return {
    charStart: -1,
    charEnd: -1,
    sourceLength: fullContent.length,
    confidence: 0.0
  };
}

async function splitDocument(document) {
  console.log('\n✂️  Splitting document into chunks with hierarchical chunker...');

  const splitDocs = adaptiveChunkDocuments([document], CHUNK_CONFIG);
  console.log(`  ✓ Created ${splitDocs.length} chunks using hierarchical splitting`);

  // Enhanced chunks with relationships
  const enhancedChunks = [];

  // Group by source document
  const chunksBySource = {};
  splitDocs.forEach((doc, index) => {
    const source = doc.metadata.source;
    if (!chunksBySource[source]) {
      chunksBySource[source] = [];
    }
    chunksBySource[source].push({ ...doc, originalIndex: index });
  });

  // Process the single document to build relationships
  for (const [source, sourceChunks] of Object.entries(chunksBySource)) {
    const originalDoc = document;
    const fullContent = originalDoc.pageContent;

    const validChunks = [];
    let skippedChunks = 0;

    sourceChunks.forEach((chunk, originalIndex) => {
      // Filter out low-quality chunks
      if (isLowQualityChunk(chunk.pageContent)) {
        console.log(`    ⚠️  Skipping low-quality chunk: "${chunk.pageContent.trim().substring(0, 50)}..."`);
        skippedChunks++;
        return;
      }

      validChunks.push({ ...chunk, originalIndex });
    });

    if (skippedChunks > 0) {
      console.log(`    ✓ Filtered out ${skippedChunks} low-quality chunks from ${source}`);
    }

    validChunks.forEach((chunk, chunkIndex) => {
      const parentId = `doc:${source}`;
      const chunkId = `${parentId}::ch${chunkIndex}`;
      const prevId = chunkIndex > 0 ? `${parentId}::ch${chunkIndex - 1}` : null;
      const nextId = chunkIndex < validChunks.length - 1 ? `${parentId}::ch${chunkIndex + 1}` : null;

      // Get header hierarchy
      const headerInfo = getHeaderHierarchy(chunk.pageContent, fullContent);

      // Calculate character offsets
      const charOffsets = calculateCharOffsets(chunk.pageContent, fullContent);

      // Find chunk heading
      const chunkHeaders = extractHeadersFromContent(chunk.pageContent);
      const heading = chunkHeaders.length > 0 ? chunkHeaders[0].fullText : '';

      // Create enhanced chunk
      const enhancedChunk = new Document({
        pageContent: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          id: chunkId,
          parentId,
          prevId,
          nextId,
          chunkNumber: chunkIndex,
          heading,
          headerPath: headerInfo.headerPath,
          headerHierarchy: headerInfo.hierarchy,
          charOffsets,
          originalIndex: chunk.originalIndex,
          // Add contextual embed text with title
          embedText: `Title: ${originalDoc.metadata.fileName}\n${headerInfo.hierarchy ? `Section: ${headerInfo.hierarchy}\n` : ''}\n${chunk.pageContent}`
        }
      });

      enhancedChunks.push(enhancedChunk);
    });
  }

  console.log(`  ✓ Created ${enhancedChunks.length} enhanced chunks with relationships`);
  return enhancedChunks;
}

async function saveChunks(chunks) {
  console.log('\n💾 Saving enhanced chunks for inspection...');

  // Create chunks directory if it doesn't exist
  try {
    await fs.mkdir(CHUNKS_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  // Group chunks by source
  const chunksBySource = {};
  chunks.forEach((chunk, index) => {
    const source = chunk.metadata.source;
    if (!chunksBySource[source]) {
      chunksBySource[source] = [];
    }
    chunksBySource[source].push({ ...chunk, globalIndex: index });
  });

  // Save chunks for each source
  for (const [source, sourceChunks] of Object.entries(chunksBySource)) {
    const outputFile = path.join(CHUNKS_DIR, `${source}-chunks.json`);

    const chunkData = {
      source: source,
      totalChunks: sourceChunks.length,
      maxTokens: CHUNK_CONFIG.maxTokens,
      minTokens: CHUNK_CONFIG.minTokens,
      generatedAt: new Date().toISOString(),
      chunks: sourceChunks.map(chunk => ({
        // Enhanced chunk structure similar to Python version
        id: chunk.metadata.id,
        parentId: chunk.metadata.parentId,
        prevId: chunk.metadata.prevId,
        nextId: chunk.metadata.nextId,
        embedText: chunk.metadata.embedText,
        displayMarkdown: chunk.pageContent,
        chunkNumber: chunk.metadata.chunkNumber,
        contentType: 'doc',
        heading: chunk.metadata.heading,
        headerPath: chunk.metadata.headerPath,
        headerHierarchy: chunk.metadata.headerHierarchy,
        charOffsets: chunk.metadata.charOffsets,
        contentLength: chunk.pageContent.length,
        globalIndex: chunk.globalIndex,
        metadata: {
          source: chunk.metadata.source,
          fileName: chunk.metadata.fileName,
          timestamp: chunk.metadata.timestamp
        },
        preview: chunk.pageContent.substring(0, 150) + '...'
      }))
    };

    await fs.writeFile(outputFile, JSON.stringify(chunkData, null, 2));
    console.log(`  ✓ Saved ${sourceChunks.length} enhanced chunks for ${source}`);
  }

  // Save individual chunk files (like Python version)
  let savedIndividualChunks = 0;
  for (const chunk of chunks) {
    // Generate filename from ID: doc:skeleton::ch0 -> doc_skeleton__ch0.json
    const safeFilename = chunk.metadata.id.replace(/:/g, '_').replace(/::/g, '__') + '.json';
    const chunkFile = path.join(CHUNKS_DIR, safeFilename);

    const individualChunk = {
      id: chunk.metadata.id,
      parentId: chunk.metadata.parentId,
      prevId: chunk.metadata.prevId,
      nextId: chunk.metadata.nextId,
      embedText: chunk.metadata.embedText,
      displayMarkdown: chunk.pageContent,
      chunkNumber: chunk.metadata.chunkNumber,
      contentType: 'doc',
      heading: chunk.metadata.heading,
      headerPath: chunk.metadata.headerPath,
      headerHierarchy: chunk.metadata.headerHierarchy,
      charOffsets: chunk.metadata.charOffsets,
      metadata: {
        source: chunk.metadata.source,
        fileName: chunk.metadata.fileName,
        timestamp: chunk.metadata.timestamp
      }
    };

    await fs.writeFile(chunkFile, JSON.stringify(individualChunk, null, 2));
    savedIndividualChunks++;
  }

  console.log(`  ✓ Saved ${savedIndividualChunks} individual chunk files`);

  // Create enhanced summary file
  const summary = {
    totalChunks: chunks.length,
    sources: Object.keys(chunksBySource),
    chunksBySource: Object.fromEntries(
      Object.entries(chunksBySource).map(([source, sourceChunks]) => [
        source,
        {
          count: sourceChunks.length,
          avgLength: Math.round(sourceChunks.reduce((sum, chunk) => sum + chunk.pageContent.length, 0) / sourceChunks.length),
          minLength: Math.min(...sourceChunks.map(chunk => chunk.pageContent.length)),
          maxLength: Math.max(...sourceChunks.map(chunk => chunk.pageContent.length)),
          hasHeaderHierarchy: sourceChunks.some(chunk => chunk.metadata.headerHierarchy),
          relationshipChains: sourceChunks.length > 1 ? `${sourceChunks[0].metadata.id} → ... → ${sourceChunks[sourceChunks.length - 1].metadata.id}` : 'Single chunk'
        }
      ])
    ),
    config: {
      maxTokens: CHUNK_CONFIG.maxTokens,
      minTokens: CHUNK_CONFIG.minTokens,
      overlapSentences: CHUNK_CONFIG.overlapSentences,
      structure: CHUNK_CONFIG.structure
    },
    relationshipFeatures: {
      prevNextLinks: chunks.filter(c => c.metadata.prevId || c.metadata.nextId).length,
      headerHierarchies: chunks.filter(c => c.metadata.headerHierarchy).length,
      charOffsetTracking: chunks.filter(c => c.metadata.charOffsets.confidence > 0.8).length
    },
    generatedAt: new Date().toISOString()
  };

  const summaryFile = path.join(CHUNKS_DIR, 'summary.json');
  await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`  ✓ Saved enhanced summary to summary.json`);

  return summary;
}

async function displaySummary(summary) {
  console.log('\n📊 Enhanced Chunk Analysis Summary');
  console.log('═'.repeat(50));
  console.log(`Total chunks: ${summary.totalChunks}`);
  console.log(`Sources: ${summary.sources.join(', ')}`);
  console.log('');

  console.log('🔗 Relationship Features:');
  console.log(`   Prev/Next links: ${summary.relationshipFeatures.prevNextLinks} chunks`);
  console.log(`   Header hierarchies: ${summary.relationshipFeatures.headerHierarchies} chunks`);
  console.log(`   Char offset tracking: ${summary.relationshipFeatures.charOffsetTracking} chunks (>80% confidence)`);
  console.log('');

  console.log('Per-source breakdown:');
  for (const [source, stats] of Object.entries(summary.chunksBySource)) {
    console.log(`  📄 ${source.toUpperCase()}`);
    console.log(`     Chunks: ${stats.count}`);
    console.log(`     Avg length: ${stats.avgLength} chars`);
    console.log(`     Range: ${stats.minLength}-${stats.maxLength} chars`);
    console.log(`     Headers: ${stats.hasHeaderHierarchy ? '✓' : '✗'}`);
    console.log(`     Chain: ${stats.relationshipChains}`);
    console.log('');
  }

  console.log(`Files saved to: ${CHUNKS_DIR}`);
  console.log('');
  console.log('🎯 Enhanced features:');
  console.log('  • Prev/next chunk relationships for sequential reading');
  console.log('  • Header hierarchy extraction for context');
  console.log('  • Character offset tracking for source mapping');
  console.log('  • Contextual embed text with title + section info');
  console.log('  • Individual chunk files for easy inspection');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Inspect chunks in the chunks/ directory');
  console.log('  2. Check individual chunk files (doc_source__ch0.json)');
  console.log('  3. Review header hierarchies and relationships');
  console.log('  4. Adjust maxTokens/minTokens in CHUNK_CONFIG if needed');
  console.log('  5. Run "pnpm docs:index" to create vector database');
}

async function main() {
  console.log('🔍 Document Chunk Inspector\n');

  const fileName = process.argv[2]; // Optional: specify single file

  try {
    if (fileName) {
      // Load single document if specified
      console.log(`Processing single file: ${fileName}`);
      const document = await loadDocument(fileName);
      const chunks = await splitDocument(document);

      // Save chunks for inspection
      const summary = await saveChunks(chunks);

      // Display summary
      await displaySummary(summary);
    } else {
      // Load all documents
      console.log('Processing all documentation files...');
      const documents = await loadAllDocuments();

      if (documents.length === 0) {
        console.log('\n⚠️  No documents found in docs directory.');
        console.log('  Run "pnpm docs:update" first to download documentation.');
        return;
      }

      const chunks = await splitDocuments(documents);

      // Save chunks for inspection
      const summary = await saveChunks(chunks);

      // Display summary
      await displaySummary(summary);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();