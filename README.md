<img src="logo-small.png" align="right" width="200" alt="packlet logo">

# 📦 packlet

**Token-aware Markdown chunker with intelligent splitting and semantic preservation**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

*mdast-driven hierarchy • recursive splitting • look-ahead packing • optional overlap • rich metadata*

## ✨ Features

- 🎯 **Smart Chunking**: Hierarchical splitting that preserves semantic units by splitting at H1 boundaries first, then H2 within each H1 section, then H3 within each H2 section, finally descending to paragraphs → sentences only when sections exceed token limits.
- 🔢 **Token-Aware**: Accurate token counting with tiktoken, not character approximations
- 🔗 **Semantic Overlap**: Sentence-based context preservation between chunks
- 📊 **Rich Metadata**: Heading breadcrumbs, token counts, and source positions
- ⚡ **High Performance**: Fast processing, even for large documents
- 🛡️ **Quality First**: Prevents low-quality chunks during creation, not post-filtering

## 🚀 Quick Start

A high-quality document chunking system for vector database indexing. Processes Markdown into semantically coherent, token-aware chunks optimized for embedding and retrieval.

## Current Status
Fully functional TypeScript with comprehensive test coverage. Still needs some cleanup around clear title/header handling, edge casea and test cleanup/clarity improvements.

## 🏗️ Architecture

The project consists of two main implementations:

### TypeScript Chunker (Primary)
Modular pipeline-based chunker following functional programming principles:

- **`index.ts`** - Main orchestration pipeline using flow composition
- **`parse-markdown.ts`** - Parse markdown to AST
- **`flatten-ast.ts`** - Extract nodes from AST (references docs/flatten-ast.md for algorithm details)
- **`split-node.ts`** - Recursive splitting of oversized nodes
- **`packer.ts`** - Intelligent buffering with look-ahead merge and small chunk prevention
- **`overlap.ts`** - Sentence-based context overlap between chunks
- **`normalize.ts`** - Text cleanup preserving code blocks
- **`metadata.ts`** - Attach chunk metadata (headings, paths, etc.)
- **`guardrails.ts`** - Quality validation and monitoring (no longer filters chunks)
- **`stats.ts`** - Performance metrics and analysis
- **`tokenizer.ts`** - Token counting (tiktoken with fallback)
- **`utils.ts`** - Flow composition utilities
- **`types.ts`** - TypeScript interfaces

### Python Implementation (Reference)
`generate_chunks.py` - Working reference implementation using LangChain for markdown chunking.

## 🎨 Design Principles

1. **Hierarchical Splitting** - Split by structure (headings → paragraphs → sentences) before arbitrary cuts
2. **Token-Aware Sizing** - Use tiktoken for accurate token measurement, not character counts
3. **Sentence-Based Overlap** - Maintains semantic continuity better than token boundaries
4. **Quality-First** - Prevent low-quality chunks during creation through intelligent packing, not post-filtering
5. **Small Pure Functions** - Each function ≤25 lines, single responsibility, no side effects where possible
6. **Flow Composition** - Pipeline uses functional composition

## 🎯 Target Metrics

- **Token Range**: ~400-500 average tokens per chunk. 64-512 strict range.
- **Processing Speed**: Optimized for fast processing
- **Quality**: 0 low-quality chunks in multi-chunk documents (small single-chunk documents are allowed)

## Flow Architecture

The chunker uses a two-phase approach with preprocessing optimization and a main pipeline:

### Phase 1: Preprocessing (Performance Optimization)
```typescript
// Early single-chunk detection
const preprocessResult = preprocess(doc, options);
if (preprocessResult.canSkipPipeline) {
  // Fast path: return single chunk directly, skip expensive AST operations
  return { chunks: [preprocessResult.chunk], stats };
}
```

### Phase 2: Main Pipeline (Complex Documents)
```typescript
const pipeline = flow(
  parseMarkdown,        // Parse markdown to AST
  flattenAst,          // Extract nodes from AST
  splitOversized,      // Recursive splitting of oversized nodes
  packNodes,           // Intelligent buffering with look-ahead merge
  addOverlap,          // Sentence-based context overlap
  normalizeChunks,     // Text cleanup preserving code blocks
  attachMetadata,      // Attach chunk metadata (headings, breadcrumbs)
  addEmbedText,        // Add embed text for vector search
  assertOrFilterInvalid // Quality validation
);

const chunks = pipeline(doc);
const stats = computeStats(chunks, options, startTime, endTime);
```

**Preprocessing Benefits**: For small documents (≤ maxTokens), the preprocessing step skips the entire pipeline, avoiding expensive AST parsing, node flattening, and splitting operations while still generating accurate statistics.

Each pipeline stage transforms the data and passes it to the next stage. Functions are pure with no side effects.

## 🛠️ Development

### Prerequisites
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-8+-F69220?style=flat-square&logo=pnpm&logoColor=white)

### Test Fixtures
The project includes markdown test fixtures in `tests/fixtures/` used for testing various chunking scenarios:
- `simple.md` - Basic markdown elements (headings, lists, code, tables)
- `headings.md` - Complex heading hierarchy testing
- `code-heavy.md` - Documents with extensive code blocks
- `large-nodes.md` - Large content sections for testing token limit handling and buffer flushing
- `small-nodes.md` - Small content sections for testing look-ahead merging behavior
- `mixed-content.md` - Various node types (headings, paragraphs, code, lists) for comprehensive testing
- Additional fixtures for specific testing scenarios

**⚠️ IMPORTANT:** Always use fixture files for tests instead of inline markdown strings. See `docs/testing-guidelines.md` for details.

### 🚀 Setup

```bash
# Install dependencies
pnpm install

# Run the chunker
pnpm dev
```

### Package Management
This project uses **pnpm** for dependency management. All commands should use `pnpm` instead of `npm` or `yarn`.

## 📚 Documentation

- **`docs/strategy.md`** - Complete 16-step algorithm specification and principles
- **`docs/flatten-ast.md`** - Detailed AST flattening algorithm
- **`docs/chunk-output-format.md`** - Complete specification for individual chunk file output format with comprehensive field definitions, examples, and migration notes
- **`docs/title-in-each-chunk.md`** - Specification for title and header handling, breadcrumb generation, and context prepending
- **`docs/testing-guidelines.md`** - ⚠️ Testing best practices and fixture usage requirements
- **`docs/stats.md`** - Statistics system documentation for performance monitoring and quality analysis
