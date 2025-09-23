# Individual Chunk File Output Format

This document describes the format for saving individual chunk files from the chunking pipeline.

## Current Implementation Status

**Pipeline Flow**: `parseMarkdown` → `flattenAst` → `splitOversized` → `packNodes` → `addOverlap` → `normalizeChunks` → `attachMetadata` → `assertOrFilterInvalid`

**Key Files**:
- `lib/index.ts`: Main pipeline orchestration
- `lib/metadata.ts`: Metadata attachment (needs updates per this spec)
- `lib/types.ts`: Type definitions (has `Chunk` and partial `EnhancedChunk`)
- `lib/packer.ts`: Creates initial chunks with `content` field

**Implementation Gap**: Currently using basic `Chunk` type with untyped metadata. `EnhancedChunk` exists but needs updates to match this spec.

## File Naming Convention

Each chunk is saved as an individual JSON file using the following naming pattern:

```
chunks/{contentType}_{docName}__ch{chunkNumber}.json
```

**Examples:**
- `chunks/doc_strategy__ch0.json`
- `chunks/doc_flatten-ast__ch1.json`
- `chunks/doc_chunk-format-documentation__ch2.json`

**Naming Rules:**
- Document name is derived from the source filename (without extension)
- Hyphens in filenames are preserved (e.g., `flatten-ast.md` → `flatten-ast`)
- Chunk numbers start at 0 and increment sequentially
- Double underscore (`__`) separates document name from chunk identifier

## JSON Structure

Each chunk file contains a single JSON object with the following structure:

```json
{
  "id": "doc:{docName}::ch{chunkNumber}",
  "parentId": "doc:{docName}",
  "prevId": "doc:{docName}::ch{prevNumber}" | null,
  "nextId": "doc:{docName}::ch{nextNumber}" | null,
  "embedText": "string",
  "originalText": "string",
  "chunkNumber": number,
  "contentType": "doc",
  "fileTitle": "string",
  "sectionTitle": "string",
  "headerPath": ["string"],
  "headerBreadcrumb": "string",
  "headerDepths": [number],
  "headerSlugs": ["string"],
  "sectionSlug": "string",
  "charOffsets": {
    "charStart": number,
    "charEnd": number,
    "totalChars": number
  },
  "tokenStats": {
    "tokens": number,
    "estimatedTokens": number
  },
  "metadata": {
    "sourceFile": "string",
    "processedAt": "ISO8601",
    "chunkingOptions": object,
    "pipeline": {
      "version": "string",
      "processingTimeMs": number
    }
  }
}
```

## Field Descriptions

### Core Identifiers
- **`id`**: Unique identifier for this chunk (`doc:{docName}::ch{number}`)
- **`parentId`**: Identifier for the parent document (`doc:{docName}`)
- **`prevId`**: ID of the previous chunk in sequence (null for first chunk)
- **`nextId`**: ID of the next chunk in sequence (null for last chunk)

### Content Fields

**Three distinct content fields serve different purposes:**

- **`content`** (internal): Used during pipeline processing. This is the working text that gets modified through various stages (normalization, overlap addition, etc.). This field is part of the basic `Chunk` type used internally but is not included in the final output.

- **`originalText`**: The chunk's content after all processing steps (normalization, overlap) but before any context prepending. This preserves the processed chunk for display purposes without breadcrumbs.

- **`embedText`**: The final text that gets embedded/encoded in vector databases. This is `originalText` with potential breadcrumbs or other context prepended based on configuration. This is what actually gets vectorized for search.

**Why all three?**
- `content` allows flexible internal processing without affecting final output structure
- `originalText` preserves the clean chunk for display/rendering
- `embedText` optimizes for search with context while keeping display text clean

Additional fields:
- **`chunkNumber`**: Zero-based sequential number within the document
- **`contentType`**: Always "doc" for documentation chunks

### Structural Information
- **`fileTitle`** (required): Document-level title passed as a required parameter to the chunking function. The calling code is responsible for extracting this from frontmatter, first H1, filename, or any other source
- **`heading`**: Primary heading that applies to this chunk (deprecated - use `sectionTitle` instead)
- **`headerPath`**: Array containing the hierarchical path of headings from the document root to the current section. Contains only heading text without markdown syntax
- **`headerBreadcrumb`**: Pre-formatted display string created by joining `headerPath` with `" > "` separator. Never includes `fileTitle`
- **`headerDepths`**: Array of heading levels (1-6) corresponding to each entry in `headerPath`
- **`headerSlugs`**: Array of URL-safe anchor IDs corresponding to each heading in `headerPath`
- **`sectionSlug`**: The URL-safe anchor ID for the current section
- **`sectionTitle`**: The heading text of the current section (last value from `headerPath`)
- **`headerHierarchy`**: String representation of heading hierarchy (deprecated - use `headerBreadcrumb` instead)

### Position Data
- **`charOffsets`**: Character-based position information representing positions in the **original source text only** (not including breadcrumbs or normalizations)
  - `charStart`: Starting character position in source document
  - `charEnd`: Ending character position in source document
  - `totalChars`: Total characters in this chunk

### Token Information
- **`tokenStats`**: Token counting information
  - `tokens`: Actual token count from tiktoken
  - `estimatedTokens`: Estimated token count using character heuristics

### Processing Metadata
- **`metadata`**: Processing and provenance information
  - `sourceFile`: Original filename that was processed
  - `processedAt`: ISO8601 timestamp of when chunk was created
  - `chunkingOptions`: Configuration used for chunking
  - `pipeline`: Version and performance information

## Example Output

For a document `strategy.md` with 4 chunks:

```
chunks/doc_strategy__ch0.json
chunks/doc_strategy__ch1.json
chunks/doc_strategy__ch2.json
chunks/doc_strategy__ch3.json
```

Each file contains the complete chunk data with proper linking:
- `ch0`: `prevId: null, nextId: "doc:strategy::ch1"`
- `ch1`: `prevId: "doc:strategy::ch0", nextId: "doc:strategy::ch2"`
- `ch2`: `prevId: "doc:strategy::ch1", nextId: "doc:strategy::ch3"`
- `ch3`: `prevId: "doc:strategy::ch2", nextId: null`

## Usage with Vector Databases

This format is optimized for:
- **Embedding**: Use `embedText` field for vector generation (includes context breadcrumbs when needed)
- **Display**: Use `originalText` for rendering results without modifications
- **Navigation**: Use `prevId`/`nextId` for chunk traversal
- **Context**: Use `headerPath` and `headerBreadcrumb` for semantic context
- **Filtering**: Use `metadata` fields for corpus organization
- **Linking**: Use `sectionSlug` for direct navigation to sections

## Compatibility

This format is compatible with:
- Vector database indexing systems
- Document retrieval pipelines
- Chunk analysis and debugging tools
- RAG (Retrieval Augmented Generation) systems

---

## Clarification Questions for Merging with chunk-format-documentation.md

### Field Discrepancies to Resolve:

1. **`displayMarkdown` vs `originalText`**:
   - chunk-format-documentation.md uses `displayMarkdown` (line 38-40)
   - This document specifies `originalText` (line 92-93)
   - **Question**: Should we standardize on `originalText` as specified in the current implementation?

2. **Token Limit Differences**:
   - chunk-format-documentation.md specifies max 625 tokens (line 85)
   - README.md mentions target ~400-500 average, 64-512 strict range (line 46)
   - **Question**: Which token limits should be the canonical specification?

3. **Metadata Structure**:
   - chunk-format-documentation.md has simpler metadata (source, fileName, timestamp) (lines 73-78)
   - This document has richer metadata with pipeline info and chunkingOptions (lines 66-74)
   - **Question**: Should we maintain both simple and extended metadata formats?

4. **Additional Fields in chunk-format-documentation.md**:
   - `nodeTypes` array (line 79) - not present in current spec
   - `tokenCount` as direct field (line 78) vs `tokenStats` object here
   - **Question**: Are nodeTypes still relevant for the current implementation?

5. **charOffsets Differences**:
   - chunk-format-documentation.md uses `sourceLength` (line 68)
   - This document uses `totalChars` (line 120)
   - **Question**: Should we standardize on `totalChars`?

### Content to Potentially Merge:

- **Chunking Strategy section** from chunk-format-documentation.md (lines 82-93) provides useful context about token limits and overlap ratios
- **Purpose descriptions** from chunk-format-documentation.md are more detailed for some fields
- **Examples** from chunk-format-documentation.md provide concrete values that could enhance understanding

### Recommendation:
Merge chunk-format-documentation.md into this document as it appears to be legacy, keeping the best of both while standardizing on the current implementation's field names.