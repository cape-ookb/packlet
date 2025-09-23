# packlet - Document Chunking System

Token-aware Markdown chunker: mdast-driven hierarchy, recursive splitting, look-ahead packing, optional overlap, rich metadata & guardrails.

## About
A high-quality document chunking system for vector database indexing. It processes Markdown into semantically coherent, token-aware chunks optimized for embedding and retrieval—using remark/mdast for structure, recursive splitting with look-ahead packing, and optional overlap. It avoids tiny/formatting-only fragments and enriches each chunk with heading breadcrumbs, token counts, and source positions for precise, high-recall search.

## Current Status
Fully functional TypeScript with comprehensive test coverage. Still needs some cleanup around clear title/header handling, edge casea and test cleanup/clarity improvements.

## Architecture

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

## Key Design Principles

1. **Hierarchical Splitting** - Split by structure (headings → paragraphs → sentences) before arbitrary cuts
2. **Token-Aware Sizing** - Use tiktoken for accurate token measurement, not character counts
3. **Sentence-Based Overlap** - Maintains semantic continuity better than token boundaries
4. **Quality-First** - Prevent low-quality chunks during creation through intelligent packing, not post-filtering
5. **Small Pure Functions** - Each function ≤25 lines, single responsibility, no side effects where possible
6. **Flow Composition** - Pipeline uses functional composition, not method chaining

## Target Metrics

- **Token Range**: ~400-500 average tokens per chunk. 64-512 strict range.
- **Processing Speed**: <10 seconds for large documents (0.5MB)
- **Quality**: 0 low-quality chunks in multi-chunk documents (small single-chunk documents are allowed)

## Flow Architecture

The chunker uses functional composition via `flow()` utility:
```typescript
const pipeline = flow(
  parseMarkdown,
  flattenAst,
  (nodes) => splitOversized(nodes, options, countTokens),
  (nodes) => packNodes(nodes, options, countTokens),
  (chunks) => addOverlap(chunks, options),
  normalizeChunks,
  (chunks) => attachMetadata(chunks, options, countTokens),
  (chunks) => assertOrFilterInvalid(chunks, options),
);
```

Each stage transforms the data and passes it to the next stage. Functions are pure with no side effects.

## Development

### Prerequisites
- Node.js ≥18.0.0
- pnpm ≥8.0.0

### Test Fixtures
The project includes markdown test fixtures in `tests/fixtures/` used for testing various chunking scenarios:
- `simple.md` - Basic markdown elements (headings, lists, code, tables)
- `headings.md` - Complex heading hierarchy testing
- `code-heavy.md` - Documents with extensive code blocks
- `large-nodes.md` - Large content sections for testing token limit handling and buffer flushing
- `small-nodes.md` - Small content sections for testing look-ahead merging behavior
- `mixed-content.md` - Various node types (headings, paragraphs, code, lists) for comprehensive testing
- Additional fixtures for specific testing scenarios

### Setup
```bash
# Install dependencies
pnpm install

# Run the chunker
pnpm dev

# Run tests (watch mode)
pnpm test

# Run tests once (CI mode)
pnpm test:run

# Run specific test file
pnpm test:run flatten-ast

# Run tests with coverage
pnpm test:coverage

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### Package Management
This project uses **pnpm** for dependency management. All commands should use `pnpm` instead of `npm` or `yarn`.

## Key Files for Understanding

- **`docs/strategy.md`** - Complete 16-step algorithm specification and principles
- **`docs/flatten-ast.md`** - Detailed AST flattening algorithm
- **`docs/chunk-output-format.md`** - Complete specification for individual chunk file output format with comprehensive field definitions, examples, and migration notes
- **`docs/title-in-each-chunk.md`** - Specification for title and header handling, breadcrumb generation, and context prepending
