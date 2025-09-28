#!/usr/bin/env npx tsx

/**
 * analyze-document.ts
 *
 * Example demonstrating the analyze pipeline.
 * Runs AST analysis on a document and prints the complete processing context.
 *
 * Usage:
 *   npx tsx examples/analyze-document.ts
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runAnalyzePipeline } from '../lib/index';
import { withDefaults } from '../lib/default-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load a test fixture for demonstration
const documentPath = join(__dirname, '../tests/fixtures/mixed-content.md');
const documentContent = readFileSync(documentPath, 'utf-8');
const documentTitle = 'mixed-content.md';

// Configure options
const options = withDefaults({
  maxTokens: 512,
  minTokens: 64,
  overlapSentences: 1
});

console.log('🔍 Document Analysis Pipeline Demo');
console.log('==================================\n');

console.log(`📄 Analyzing: ${documentTitle}`);
console.log(`📊 Document size: ${documentContent.length} characters\n`);

// Show a preview of the document content
console.log('📋 Document Preview:');
console.log('--------------------');
const preview = documentContent.split('\n').slice(0, 10).join('\n');
console.log(preview);
if (documentContent.split('\n').length > 10) {
  console.log('... (content truncated for preview)');
}
console.log();

// Run the analyze pipeline
console.log('⚙️  Running Analysis Pipeline...\n');
const startTime = performance.now();
const result = runAnalyzePipeline(documentContent, documentTitle, options);
const endTime = performance.now();

console.log(`✅ Analysis completed in ${(endTime - startTime).toFixed(2)}ms\n`);

// Display the complete context result
console.log('📊 Complete Processing Context:');
console.log('==============================\n');

// Source information
console.log('🏷️  Source Information:');
console.log(`   Title: ${result.source.title}`);
console.log(`   Length: ${result.source.length} characters`);
console.log(`   Tokens: ${result.source.tokens}`);
console.log(`   Estimated chunks: ${result.source.estimatedChunks}`);
console.log();

// Options used
console.log('⚙️  Processing Options:');
console.log(`   Max tokens: ${result.options.maxTokens}`);
console.log(`   Min tokens: ${result.options.minTokens}`);
console.log(`   Overlap sentences: ${result.options.overlapSentences}`);
console.log(`   Breadcrumb mode: ${result.options.breadcrumbMode}`);
console.log(`   Target tokens: ${result.options.targetTokens || 'auto'}`);
console.log();

// Timer information
console.log('⏱️  Timing Information:');
console.log(`   Start time: ${result.timer.startTime.toFixed(2)}ms`);
console.log(`   End time: ${result.timer.endTime?.toFixed(2)}ms`);
console.log(`   Duration: ${result.timer.durationMs?.toFixed(2)}ms`);
console.log();

// Processing stage
console.log('🔄 Processing Stage:');
console.log(`   Current stage: ${result.stage}`);
console.log();

// AST information
console.log('🌳 AST Information:');
if (result.ast) {
  console.log(`   Type: ${result.ast.type}`);
  console.log(`   Children: ${result.ast.children?.length || 0} top-level nodes`);
} else {
  console.log('   AST: Not available');
}
console.log();

// Structure analysis
console.log('🏗️  Structure Analysis:');
if (result.structure) {
  console.log(`   Headings: ${result.structure.headingCount}`);
  console.log(`   Paragraphs: ${result.structure.paragraphCount}`);
  console.log(`   Code blocks: ${result.structure.codeBlockCount}`);
  console.log(`   Lists: ${result.structure.listCount}`);
  console.log(`   Tables: ${result.structure.tableCount}`);
} else {
  console.log('   Structure: Not available');
}
console.log();

// Detailed structure analysis
console.log('🔬 Detailed Structure Analysis:');
if (result.structure) {
  console.log('   Heading levels:');
  Object.entries(result.structure.headingLevels).forEach(([level, count]) => {
    console.log(`     - H${level}: ${count}`);
  });

  console.log('   Node type distribution:');
  Object.entries(result.structure.nodeTypeDistribution).forEach(([type, count]) => {
    console.log(`     - ${type}: ${count}`);
  });

  console.log(`   Max nesting depth: ${result.structure.maxNestingDepth}`);
  console.log(`   Links: ${result.structure.linkCount}`);
  console.log(`   Images: ${result.structure.imageCount}`);
  console.log(`   Blockquotes: ${result.structure.blockquoteCount}`);
  console.log(`   Horizontal rules: ${result.structure.horizontalRuleCount}`);
  console.log(`   Has frontmatter: ${result.structure.hasFrontmatter}`);
  console.log(`   Has table of contents: ${result.structure.hasTableOfContents}`);

  if (result.structure.avgParagraphLength) {
    console.log(`   Avg paragraph length: ${result.structure.avgParagraphLength} chars`);
  }
}
console.log();

// Context fields summary
// console.log('📋 Complete Context Fields:');
// console.log('   ✅ source (document info & metrics)');
// console.log('   ✅ options (processing configuration)');
// console.log('   ✅ timer (performance timing)');
// console.log('   ✅ stage (processing stage)');
// console.log('   ✅ ast (parsed markdown tree)');
// console.log('   ✅ structure (document structure stats)');
// console.log();

// console.log('🎯 Use Cases for Analysis Pipeline:');
// console.log('  • Quick document structure inspection');
// console.log('  • Debugging markdown parsing issues');
// console.log('  • Getting document metrics without chunking');
// console.log('  • Testing AST analysis in isolation');
// console.log('  • Performance testing (fast, no chunking overhead)');
// console.log();

// console.log('💡 Next Steps:');
// console.log('  • Use runFullPipeline() for complete chunking');
// console.log('  • Use individual pipeline steps for custom workflows');
// console.log('  • Examine result.ast for detailed AST inspection');
// console.log('  • Check result.structure for document composition');

// Raw JSON output option
const showRawJSON = process.argv.includes('--json');
if (showRawJSON) {
  console.log('\n🔧 Raw JSON Output:');
  console.log('===================');
  delete result.ast;
  delete result.source.content;
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('\n✨ Analysis complete! Use --json flag to see raw JSON output.');
}
