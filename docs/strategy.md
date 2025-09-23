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

2. **Hierarchy First**

   * Split by logical structure (Markdown headings → paragraphs → sentences).
   * Only descend into finer levels when a section is too large.
   * Use an AST (e.g. Markdown → mdast) to identify structure reliably.

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
   * Merge very short chunks (except titles, which attach to their first child).
   * Prevent low-quality chunks at creation time, not through post-filtering
   * Never exceed the token limit.
   * Define minimum meaningful chunk size (e.g., ~200–300 tokens)

8. **Performance**
   * Complete chunking in seconds, not minutes
   * **Speed**: Complete chunking of a large docs (0.5MB total) in < 10 seconds
   * **Quality**: Produce 0 low-quality chunks. 1 maximum for edge cases.
   * **Memory**: Process documents incrementally, not all in memory

9. **Normalization**
   * Clean whitespace, dedent code, collapse extra line breaks.
   * Keep fenced code blocks intact (AST makes this trivial).

## Step-by-Step Process

1. Configuration object sets token budgets (target, min, max, overlap)
2. Compute total token count
3. Estimate chunks based on target size. `count = ceil(totalTokens / cfg.targetTokens)`
4. Parse Markdown into an AST
4. Flatten AST. Tree to array (./flatten-ast.md)
5. Extract nodes in hierarchical order
6. Measure token length of each node
7. If node exceeds max tokens, apply recursive splitting logic (split by paragraph → sentence → hard cut)
7. Accumulate nodes into chunks until near max token limit
8. If a chunk is too small, merge it with the next node
9. If a single node exceeds max tokens, split it with finer rules or hard-cut as a last resort
10. Flush chunk when token limit is reached
11. Add overlap sentences from previous chunk
12. Normalize text and preserve code blocks intact
13. Attach metadata such as heading trail and node type
14. Enforce guardrails on very short or oversized chunks
15. Compute actual chunk stats (count, min/avg/median/max tokens) and compare to the estimate
16. Flag deviations beyond tolerance and emit summary metrics and timing alongside the chunks

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
