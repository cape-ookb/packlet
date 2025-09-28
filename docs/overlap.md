# Overlap Strategy

## Theory: Forward-Only Overlap

In practice, **you only need overlap in one direction** (forward).

Here's why:

* When you chunk sequentially, each chunk carries forward context from the previous chunk
* This provides continuity—whichever chunk is pulled during retrieval, the model sees enough surrounding context
* Bidirectional overlap would double the redundancy, inflating storage and potentially confusing similarity scoring

The pattern looks like:

```
[----- Chunk 1 -----]
              [overlap----- Chunk 2 -----]
                                    [overlap----- Chunk 3 -----]
```

Where `overlap` is content carried forward from the previous chunk's ending.

## Implementation in This Project

This chunker implements **sentence-based forward overlap** (see `lib/overlap.ts`):

### Key Features

1. **Sentence-Based**: Instead of raw token overlap, we extract complete sentences
   - Preserves semantic units (complete thoughts)
   - Headers naturally stay with their content
   - Better for retrieval quality

2. **Configurable Count**: Default is 2 sentences (see `lib/default-config.ts`)
   - Set via `overlapSentences` option
   - Typically 1-3 sentences works best

3. **Smart Extraction**:
   - Uses regex to detect sentence boundaries (`/(?<=[.!?])\s+/`)
   - Handles edge cases like code blocks and lists
   - Falls back gracefully when sentence detection fails

### How It Works

```typescript
// From lib/overlap.ts
function addOverlap(chunks: Chunk[], options: ChunkOptions): Chunk[] {
  // First chunk has no overlap
  const result = [chunks[0]];

  // Each subsequent chunk gets trailing sentences from previous
  for (let i = 1; i < chunks.length; i++) {
    const previousContent = chunks[i - 1].content;
    const overlap = getTrailingSentences(previousContent, options.overlapSentences);

    // Prepend overlap to current chunk
    const newContent = `${overlap} ${chunks[i].content}`;
    result.push({ ...chunks[i], content: newContent });
  }

  return result;
}
```

### Benefits Over Token-Based Overlap

* **Semantic Integrity**: Complete thoughts vs arbitrary cutoffs
* **Consistent Context**: Headers and their content stay together
* **Better Embeddings**: Sentence boundaries create more meaningful overlap

### When You Might Want Different Strategies

* **Non-sequential chunks**: From different sections needing bidirectional context
* **Dialogues/transcripts**: Where continuity in both directions matters
* **Very small chunks**: Where sentence overlap might be too large

For typical Markdown documentation (technical guides, references), forward-only sentence-based overlap provides the best balance of context preservation and storage efficiency.