# Hierarchical Document Chunking Strategy

This document defines the ideal chunking approach for creating high-quality, semantically coherent chunks from documentation.

## Core Principles

### Core Principles of the Chunker

1. **Small, Testable, Pure Functions**
   * Single responsibility: Each function does exactly one conceptual thing (parse, measure, pack, overlap, normalize, or annotate).
   * Size cap: Aim ≤ 25 lines body; hard cap 40. If it grows, split it.
   * Complexity cap: Cyclomatic complexity ≤ 5 (ESLint rule recommended).
   * Parameters: ≤ 3 positional params; prefer a single typed options object.
   * Purity: No I/O, timing, or mutation of external state. Return new values.
   * Determinism: Same inputs → same outputs. No hidden globals.
   * Composition: Multi-step tasks small functions; no “god” functions. Prefer function composition using a simple flow/compose utility (e.g., lodash/fp flow, Ramda pipe), not foo().bar().baz().
   * Boundaries: Side-effects (file I/O, network, logging) live in thin adapter functions at the edges only.
   * Unit tests per function (Vitest). Each has success and edge-case tests.
   * Test Coverage target: ≥ 90% for core chunker modules.
   * Filenames `kebab-case.ext`. No uppercase.

2. **Hierarchy First - Descending Order Processing**

   * **Primary boundaries are headings**: Split at H1 first, then within each H1 split at H2, then within each H2 split at H3
   * **Section definition**: Each Hn section includes its heading line plus all following content up to the next heading of the same or higher level
   * **Depth-first processing**: Process content within each H1 section completely before moving to the next H1
   * **No cross-boundary mixing**: Never mix content from different H1 sections or sibling H2 sections in the same chunk
   * Only descend to finer levels (paragraphs → sentences) when a heading section exceeds token limits
   * Use an AST (e.g. Markdown → mdast) to identify structure reliably

3. **Token-Aware Sizing**

   * Measure chunk size by tokens (using `js-tiktoken`), not characters.
   * Target chunks between `min_tokens` and `max_tokens`.

4. **Greedy Packing with Look-Ahead**

   * Accumulate pieces until near the token budget.
   * If a chunk is too small, merge with the next piece to avoid micro-chunks.

5. **Soft Overlap**

   * Include last N complete trailing sentences from the previous chunk for continuity.
   * Table overlap is just the header row, not previous row(s).

6. **Preserve Structure and Metadata**

   * Keep Markdown hierarchy (headings, code blocks, lists).
   * Attach metadata like section headings, file path, or symbol names to each chunk.
   * Use AST nodes to avoid splitting inside code blocks, tables, or lists.

7. **Guardrails on Chunk Quality**
   * Prevent low-quality chunks during creation through intelligent packing, not post-filtering
   * Single-chunk documents: Allow any size (entire small file = valid chunk)
   * Multi-chunk documents: Merge small final chunks with previous (or next) chunks to prevent orphaned small chunks
   * May slightly exceed maxTokens to avoid creating tiny chunks (quality over strict limits)
   * Define minimum meaningful chunk size (e.g., 64+ tokens for multi-chunk documents)

8. **Performance**
   * Complete chunking in seconds, not minutes
   * **Speed**: Complete chunking of a large docs (0.5MB total) in < 10 seconds
   * **Quality**: Produce 0 low-quality chunks in multi-chunk documents (small single-chunk documents are allowed)
   * **Memory**: Process documents incrementally, not all in memory

9. **Normalization**
   * Clean whitespace, dedent code, collapse extra line breaks.
   * Keep fenced code blocks intact (AST makes this trivial).

## Hierarchical Boundary Rules

### Primary Splitting Order
1. **H1 boundaries** - Split document into H1 sections first
2. **H2 boundaries** - Within each H1, split by H2 sections
3. **H3 boundaries** - Within each H2, split by H3 sections
4. **Paragraph boundaries** - Only when heading sections exceed limits
5. **Sentence boundaries** - Only when paragraphs exceed limits
6. **Hard cuts** - Last resort for oversized atomic content

### Section Integrity Rules
- **Complete sections**: Each Hn section = heading + all content until next same/higher heading
- **No boundary crossing**: Never mix content from different H1 sections
- **No sibling mixing**: Never mix content from sibling H2 or H3 sections
- **Depth-first processing**: Complete all content within an H1 before moving to next H1

## Step-by-Step Process

1. Configuration object sets token budgets (target, min, max, overlap)
2. Compute total token count
3. Estimate chunks based on target size. `count = ceil(totalTokens / cfg.targetTokens)`
4. Parse Markdown into an AST
4. Flatten AST into hierarchical node sequence (./flatten-ast.md)
5. Extract nodes in descending hierarchical order: H1 sections first, then H2 within each H1, then H3 within each H2
6. Measure token length of each node
7. If node exceeds max tokens, apply recursive splitting logic (split by paragraph → sentence → hard cut)
7. Determine if entire document would fit in single chunk (prevention strategy decision)
8. For single-chunk documents: Accumulate all nodes into one chunk regardless of size
9. For multi-chunk documents: Accumulate nodes with small chunk prevention logic
10. If a chunk would be too small in multi-chunk mode, keep accumulating or merge with previous chunk
11. If a single node exceeds max tokens, split it with finer rules or hard-cut as a last resort
12. Flush chunk when token limit is reached (only if meets minimum or is single-chunk)
13. Add overlap sentences from previous chunk
14. Normalize text and preserve code blocks intact
15. Attach metadata such as heading trail and node type
16. Validate chunk quality and report issues (no filtering)
17. Compute actual chunk stats (count, min/avg/median/max tokens) and compare to the estimate
18. Flag deviations beyond tolerance and emit summary metrics and timing alongside the chunks

## Small Chunk Prevention Strategy

Our approach prevents low-quality chunks during creation rather than filtering them afterward:

### Single-Chunk Documents
- **Definition**: Entire document fits within `maxTokens`
- **Strategy**: Allow any size chunk (even if below `minTokens`)
- **Rationale**: Small documents shouldn't be penalized for being small

### Multi-Chunk Documents
- **Definition**: Document requires splitting due to size
- **Strategy**: Prevent chunks below `minTokens` through intelligent merging
- **Implementation**:
  - Keep accumulating nodes if current chunk would be too small
  - Merge small final chunks with previous chunks (may exceed `maxTokens` slightly)
  - Quality over strict token limits

### Benefits
- No orphaned tiny chunks in large documents
- Preserves small documents as valid single chunks
- Maintains semantic coherence by preferring slightly larger chunks over fragmented tiny ones
- Clear quality guarantee: 0 small chunks in multi-chunk scenarios

### Throw (Fail Fast)
* Best during early development.
* Forces you to tighten the splitter logic until these cases can’t happen.
* Makes automated tests cleaner (expected = 0 invalid chunks).

### “Done” acceptance criteria
* No function exceeds line/complexity caps.
* No side effects in core functions; effects only in boundary adapters.
* All core functions individually testable and tested.
* End-to-end pipeline composes via small functions, not one monolith.

### 6. **Context Overlap Strategy**
**Sentence-based overlap** (recommended):
- Extract last N complete sentences from previous chunk
- Prepend to current chunk for context continuity
- Maintains semantic meaning rather than arbitrary token boundaries
