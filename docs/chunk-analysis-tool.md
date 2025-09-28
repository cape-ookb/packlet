# Chunk Analysis Tool

The `analyze-chunks.ts` tool provides visual and statistical analysis of how documents are chunked, making it easy to review and optimize chunking behavior.

## Quick Start

```bash
# Basic visual analysis
npx tsx examples/analyze-chunks.ts docs/overlap.md --visual

# Full analysis with statistics
npx tsx examples/analyze-chunks.ts README.md --visual --stats --verbose

# Custom chunking parameters
npx tsx examples/analyze-chunks.ts docs/title-in-each-chunk.md --max-tokens 1024 --min-tokens 128 --overlap 3
```

## Usage

```
npx tsx examples/analyze-chunks.ts <file.md> [options]
```

### Options

- `--visual` - Show visual chunk boundaries and content preview (default when no other options)
- `--stats` - Display comprehensive statistics
- `--verbose` - Show detailed information including IDs and embed text
- `--max-tokens N` - Set maximum tokens per chunk (default: 512)
- `--min-tokens N` - Set minimum tokens per chunk (default: 64)
- `--overlap N` - Set overlap sentences (default: 2)

## Output Formats

### Visual Analysis (`--visual`)

Shows each chunk in a bordered box with:
- **Chunk number** and total count
- **Token count** with visual bar representation
- **Section path** from headers (breadcrumb trail)
- **Content types** (heading, paragraph, code, etc.)
- **Content preview** (first 5 lines, truncated)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔸 CHUNK 1/7              │ 78 tokens       │ ████████                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ 📍 Section: Overlap Strategy                                                  │
│ 🏷️  Types: heading, paragraph, list-item                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ # Overlap Strategy                                                           │
│                                                                              │
│ ## Theory: Forward-Only Overlap                                             │
│                                                                              │
│ In practice, you only need overlap in one direction (forward).               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Detailed List (default without `--visual`)

Shows each chunk with:
- Token count and content types
- Header path and section title
- Content preview (200 chars)
- Optional: Chunk IDs and embed text (with `--verbose`)

### Statistics (`--stats`)

Provides comprehensive analysis:
- **Summary**: Total chunks, tokens, averages, min/max sizes
- **Token Distribution**: Small/medium/large chunk counts
- **Section Analysis**: Number of unique sections
- **Content Types**: Frequency of different node types
- **Processing Time**: Performance metrics

## Use Cases

### 1. **Optimize Chunk Sizes**
```bash
# Check if chunks are too large/small
npx tsx examples/analyze-chunks.ts my-doc.md --stats
```

### 2. **Review Section Boundaries**
```bash
# See how sections are split across chunks
npx tsx examples/analyze-chunks.ts my-doc.md --visual --verbose
```

### 3. **Test Different Parameters**
```bash
# Compare different chunking strategies
npx tsx examples/analyze-chunks.ts my-doc.md --max-tokens 256 --overlap 1
npx tsx examples/analyze-chunks.ts my-doc.md --max-tokens 1024 --overlap 3
```

### 4. **Validate Content Types**
```bash
# Ensure code blocks, tables, lists are handled correctly
npx tsx examples/analyze-chunks.ts technical-doc.md --verbose
```

### 5. **Check Overlap Effectiveness**
```bash
# Review how overlap maintains context between chunks
npx tsx examples/analyze-chunks.ts my-doc.md --visual --verbose
```

## Example Output

Running on a typical documentation file:

```
📊 Total Chunks: 7
🎯 Total Tokens: 1,234
📐 Average Size: 176 tokens
📉 Min Size: 78 tokens
📈 Max Size: 312 tokens

📊 Token Distribution:
   Small (<200): 5 chunks
   Medium (200-399): 2 chunks
   Large (400+): 0 chunks

🏷️  Content Types:
   paragraph: 23 occurrences
   heading: 12 occurrences
   list-item: 8 occurrences
   code: 3 occurrences
```

## Integration with Development Workflow

Add to your development process:

1. **Before committing documentation** - Run analysis to ensure good chunk distribution
2. **When tuning parameters** - Compare different configurations
3. **When debugging chunking issues** - Use verbose mode to see detailed breakdown
4. **For performance optimization** - Monitor processing times and token efficiency

The tool helps ensure your documents will be effectively chunked for RAG systems, embeddings, and other downstream processing.