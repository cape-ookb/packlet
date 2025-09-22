# Chunker Context Summary

## Current Status
Working on building a high-quality document chunking system in TypeScript. The goal is to create semantically coherent chunks for vector database indexing with low-quality chunks.

## Problem Identified
The existing hierarchical chunker (`scripts/lib/hierarchical-chunker.js`) has a performance bug causing timeouts when processing large documents. It should complete in <10 seconds but hangs indefinitely.

## Architecture
Modular TypeScript chunker in `/chunker` directory with these files:
- `index.ts` - Pipeline orchestration using flow composition
- `parse-markdown.ts` - Parse markdown to AST
- `flatten-ast.ts` - Extract nodes from AST (references flatten-ast.md for algorithm details)
- `split-node.ts` - Recursive splitting of oversized nodes
- `packer.ts` - Intelligent buffering with look-ahead merge
- `overlap.ts` - Sentence-based context overlap
- `normalize.ts` - Text cleanup preserving code blocks
- `metadata.ts` - Attach chunk metadata
- `guardrails.ts` - Quality validation
- `stats.ts` - Performance metrics
- `tokenizer.ts` - Token counting (tiktoken/heuristic)
- `utils.ts` - Flow utility
- `types.ts` - TypeScript interfaces

## Key Design Decisions
1. **Hierarchical splitting** - Only split when chunks exceed token limits
2. **Sentence overlap** - Better than token overlap for semantic continuity
3. **Quality filtering during creation** - Not post-filtering
4. **Target metrics**: 200-400 chunks, 400-500 avg tokens, <10 sec processing

## Related Files
- `/chunker/*.ts` - TypeScript implementation stubs with detailed documentation
- `/scripts/chunking-strategy.md` - Complete algorithm specification (16-step process)
- `/chunker/flatten-ast.md` - Referenced for detailed flattening algorithm
