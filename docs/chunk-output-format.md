# Individual Chunk File Output Format

This document describes the format for saving individual chunk files from the chunking pipeline.

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