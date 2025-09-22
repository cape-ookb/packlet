# Document Chunking System

A high-quality document chunking system designed for vector database indexing. Processes markdown documents (especially documentation) into semantically coherent chunks optimized for embedding and retrieval.

## Current Status
Working on building a high-quality document chunking system in TypeScript. The goal is to create semantically coherent chunks for vector database indexing with low-quality chunks.

## Architecture

The project consists of two main implementations:

### TypeScript Chunker (Primary)
Modular pipeline-based chunker following functional programming principles:

- **`index.ts`** - Main orchestration pipeline using flow composition
- **`parse-markdown.ts`** - Parse markdown to AST
- **`flatten-ast.ts`** - Extract nodes from AST (references flatten-ast.md for algorithm details)
- **`split-node.ts`** - Recursive splitting of oversized nodes
- **`packer.ts`** - Intelligent buffering with look-ahead merge
- **`overlap.ts`** - Sentence-based context overlap between chunks
- **`normalize.ts`** - Text cleanup preserving code blocks
- **`metadata.ts`** - Attach chunk metadata (headings, paths, etc.)
- **`guardrails.ts`** - Quality validation and filtering
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
4. **Quality-First** - Prevent low-quality chunks during creation, not through post-filtering
5. **Small Pure Functions** - Each function ≤25 lines, single responsibility, no side effects where possible
6. **Flow Composition** - Pipeline uses functional composition, not method chaining

## Target Metrics

- **Token Range**: ~400-500 average tokens per chunk. 64-512 strict range.
- **Processing Speed**: <10 seconds for large documents (0.5MB)
- **Quality**: 0 low-quality chunks (1 maximum for edge cases)

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

- **`@strategy.md`** - Complete 16-step algorithm specification and principles
- **`@flatten-ast.md`** - Detailed AST flattening algorithm
- **`@chunk-format-documentation.md`** - Output chunk structure specification
