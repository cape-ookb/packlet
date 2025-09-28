# Examples

This directory contains example scripts demonstrating various features of the chunking library.

## analyze-document.ts

Demonstrates the analyze pipeline by running AST analysis on a document and displaying the complete processing context.

**Usage:**
```bash
# Run the analysis demo
npx tsx examples/analyze-document.ts

# Show raw JSON output
npx tsx examples/analyze-document.ts --json
```

**What it shows:**
- Document source information (size, tokens, estimated chunks)
- Processing options and configuration
- Timing and performance metrics
- Complete AST structure and node distribution
- Document structure analysis (headings, paragraphs, code blocks, etc.)
- Extended analysis with heading levels, links, images, etc.
- What fields are available vs. not generated in analysis-only mode

**Use cases:**
- Understanding what the analyze pipeline provides
- Quick document structure inspection
- Debugging markdown parsing issues
- Performance testing without chunking overhead

## Other Examples

See the main `examples/` directory for additional examples like:
- `chunk-docs.ts` - Complete document chunking
- `analyze-chunks.ts` - Chunk analysis and statistics