### Chunker Development Task List

1. **Set up parser**: Install `remark-parse` (and `remark-gfm` for tables) and confirm Markdown → mdast parsing works on sample docs. Deliverable: `parseMarkdown.ts` that returns an mdast tree.

2. **Flatten AST**: Write `flattenAst.ts` that converts mdast → array of flat nodes (headings, paragraphs, list items, code blocks, tables, blockquotes). Deliverable: function + unit test with sample Markdown input and expected node array.

3. **Token counter**: Implement `tokenizer.ts` wrapping `js-tiktoken`. Deliverable: function `countTokens(text)` with test verifying counts on sample text.

4. **Recursive splitter**: Implement `splitNode.ts` to split oversized nodes (paragraph → sentences → hard cut). Deliverable: function with test showing oversized paragraph split into smaller nodes.

5. **Node packer**: Write `packer.ts` to accumulate nodes into chunks within min/max token budgets, with look-ahead merging. Deliverable: function + test ensuring no chunk exceeds max tokens.

6. **Overlap**: Implement `overlap.ts` to prepend trailing sentences from previous chunk. Deliverable: function + test showing overlap applied correctly.

7. **Normalization**: Write `normalize.ts` to clean whitespace, dedent code, collapse extra blank lines, preserve fenced blocks. Deliverable: function + test with messy Markdown.

8. **Metadata**: Implement `metadata.ts` to attach heading trail, node type, token count, unique chunk ID. Deliverable: function + test showing metadata attached.

9. **Guardrails**: Write `guardrails.ts` to detect invalid chunks (too short, formatting-only, orphaned code, empty headers). Deliverable: function + test cases for each invalid type.

10. **Stats**: Implement `stats.ts` to compute total tokens, expected vs actual chunks, min/avg/max tokens. Deliverable: function + test on sample doc.

11. **Pipeline**: Wire everything together in `index.ts` with `flow`. Deliverable: `chunkMarkdown(doc, opts)` returning `{ chunks, stats }`.

12. **Tests**: Write one test file per module in `tests/`. Deliverable: green test suite covering all modules with sample Markdown.
