# Statistics System

The chunker includes a comprehensive statistics system that tracks chunking performance, quality metrics, and processing efficiency. Statistics are automatically computed after each chunking operation and provide insights for performance tuning and quality monitoring.

## Overview

Statistics are computed by the `computeStats` function in `lib/stats.ts:122` and returned alongside chunks from the main `chunkMarkdown` function in `lib/index.ts:45`. The stats system measures:

- **Performance**: Token counts, processing time, efficiency ratios
- **Quality**: Expected vs actual chunk counts, deviation metrics, quality flags
- **Distribution**: Token distribution analysis across target ranges

## Data Structure

The `ChunkStats` type (defined in `lib/stats.ts:33`) contains:

```typescript
export type ChunkStats = {
  // Basic counts
  totalChunks: number;
  totalTokens: number;

  // Token distribution
  minTokens: number;
  maxTokens: number;
  avgTokens: number;
  medianTokens: number;

  // Expected vs actual analysis
  expectedChunks: number;
  actualChunks: number;
  efficiencyRatio: number; // actual/expected (closer to 1.0 is better)
  deviation: number; // percentage deviation from expected

  // Distribution analysis
  tokenDistribution: {
    underTarget: number;
    atTarget: number;
    overTarget: number;
  };

  // Quality metrics
  sourceLength: number;
  compressionRatio: number; // totalTokens/sourceLength
  qualityFlag: boolean; // true if deviation > 20%

  // Performance metrics (added by pipeline)
  processingTimeMs?: number;
  processingTime?: string;
};
```

## Lifecycle

### 1. Initialization
Statistics collection begins when `chunkMarkdown` is called:
- Start time is captured using `performance.now()`
- Processing begins through the chunking pipeline

### 2. Computation
After chunking completes, `computeStats` is called with:
- The resulting chunks array
- Chunk options (for expected chunk calculation)
- Start and end timestamps (for performance metrics)

### 3. Analysis
The function performs several calculations:

#### Basic Token Statistics
- **Total tokens**: Sum of all chunk token counts
- **Min/Max/Average**: Basic distribution metrics
- **Median**: Middle value for token distribution

#### Expected vs Actual Analysis
- **Expected chunks**: Estimated using `sourceLength / 3.8 / targetTokens` heuristic
- **Efficiency ratio**: `actualChunks / expectedChunks` (optimal ≈ 1.0)
- **Deviation**: Percentage difference from expected count
- **Quality flag**: Set to `true` if deviation > 20%

#### Token Distribution
Categorizes chunks relative to target token count (±10% tolerance):
- **Under target**: Chunks below target range
- **At target**: Chunks within acceptable range
- **Over target**: Chunks exceeding target range

### 4. Return
Statistics are returned as part of the result object from `chunkMarkdown`:

```typescript
const result = chunkMarkdown(content, filename, options);
// result.chunks contains the chunks
// result.stats contains the statistics
```

## Usage Examples

### Basic Usage
```typescript
import { chunkMarkdown } from './lib';

const result = chunkMarkdown(content, 'document.md', {
  minTokens: 100,
  maxTokens: 400,
  targetTokens: 250,
  overlapSentences: 1
});

console.log(`Generated ${result.stats.totalChunks} chunks`);
console.log(`Processing time: ${result.stats.processingTime}`);
console.log(`Quality check: ${result.stats.qualityFlag ? 'Failed' : 'Passed'}`);
```

### Using the Analysis Tool
The `examples/analyze-chunks.ts` script provides detailed statistics visualization:

```bash
npx tsx examples/analyze-chunks.ts docs/example.md --stats
```

This displays comprehensive statistics including:
- Token distribution charts
- Efficiency metrics
- Quality indicators
- Performance data

### Programmatic Access
```typescript
// Access specific metrics
const { stats } = chunkMarkdown(content, filename, options);

if (stats.qualityFlag) {
  console.warn(`Quality issue: ${Math.round(stats.deviation * 100)}% deviation from expected`);
}

if (stats.efficiencyRatio < 0.8 || stats.efficiencyRatio > 1.2) {
  console.warn('Chunking efficiency outside optimal range');
}

// Analyze token distribution
const { tokenDistribution } = stats;
console.log(`Distribution: ${tokenDistribution.atTarget}/${stats.totalChunks} chunks at target`);
```

## Key Metrics

### Efficiency Ratio
- **Optimal range**: 0.8 - 1.2
- **Values < 0.8**: Too few chunks (chunks too large)
- **Values > 1.2**: Too many chunks (chunks too small)

### Quality Flag
- **Triggered when**: Deviation > 20%
- **Indicates**: Significant difference between expected and actual chunking
- **Common causes**: Content structure mismatches, inappropriate token targets

### Compression Ratio
- **Formula**: `totalTokens / sourceLength`
- **Typical range**: 0.2 - 0.3 for English text
- **Higher values**: More token-dense content (code, technical text)
- **Lower values**: More natural language content

## Integration Points

### Pipeline Integration
Statistics are computed at the end of the chunking pipeline:
1. **Parse** → **Flatten** → **Split** → **Pack** → **Overlap** → **Normalize** → **Metadata** → **Validate**
2. **Statistics computation** (final step)

### Development Workflow
- **Unit tests**: `tests/stats.test.ts` provides comprehensive test coverage
- **Examples**: Both `chunk-docs.ts` and `analyze-chunks.ts` demonstrate stats usage
- **Type safety**: Full TypeScript support with strict typing

### Monitoring
Statistics provide key metrics for production monitoring:
- Processing time trends
- Quality degradation detection
- Performance optimization opportunities
- Content-specific tuning insights

## Testing

The statistics system is thoroughly tested in `tests/stats.test.ts` with coverage for:
- Empty chunk arrays
- Single chunk scenarios
- Token distribution calculations
- Expected vs actual analysis
- Edge cases and validation
- Fixture-based integration tests

Run stats tests with:
```bash
npm test -- stats
```