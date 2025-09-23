# Individual Chunk File Output Format

This document describes the format for saving individual chunk files from the chunking pipeline.

## Current Implementation Status

**Pipeline Flow**: `parseMarkdown` → `flattenAst` → `splitOversized` → `packNodes` → `addOverlap` → `normalizeChunks` → `attachMetadata` → `assertOrFilterInvalid`

**Key Files**:
- `lib/index.ts`: Main pipeline orchestration
- `lib/metadata.ts`: Metadata attachment (implements this spec)
- `lib/types.ts`: Type definitions (has unified `Chunk` type with all enhanced fields)
- `lib/packer.ts`: Creates initial chunks with `content` field

**Implementation Status**: Using unified `Chunk` type with optional enhanced fields. Fields are populated during metadata attachment stage.

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
  // Required core identifiers
  "id": "doc:{docName}::ch{chunkNumber}",
  "parentId": "doc:{docName}",
  "chunkNumber": number,

  // Required content fields
  "embedText": "string",
  "originalText": "string",

  // Required position and token data
  "sourcePosition": {
    "charStart": number,
    "charEnd": number,
    "totalChars": number
  },
  "tokenStats": {
    "tokens": number,
    "estimatedTokens": number
  },

  // Navigation
  "prevId": "doc:{docName}::ch{prevNumber}" | null,
  "nextId": "doc:{docName}::ch{nextNumber}" | null,

  // Pipeline processing information
  "pipeline": {
    "version": "string",
    "processingTimeMs": number
  },

  // Chunking configuration used to generate this chunk
  "chunkingOptions": {
    "minTokens": number,
    "maxTokens": number,
    "overlapSentences": number,
    "breadcrumbMode": "conditional" | "always" | "none"
  },

  // Metadata for vector database filtering and organization
  "metadata": {
    "contentType": "doc",
    "sourceFile": "string",
    "fileTitle": "string",
    "sectionTitle": "string",
    "headerPath": ["string"],
    "headerBreadcrumb": "string",
    "headerDepths": [number],
    "headerSlugs": ["string"],
    "sectionSlug": "string",
    "nodeTypes": ["paragraph", "list", "code"],
    "processedAt": "ISO8601"
  }
}
```

## Field Descriptions

Each chunk represents a semantically meaningful segment of content (typically from markdown documents) optimized for vector embedding and retrieval.

## Required Fields

### Core Identifiers (Required)
- **`id`** *(required)*: Unique identifier for this chunk in format `{contentType}:{docName}::ch{number}`
  - Example: `"doc:skeleton::ch4"`
  - Used for direct chunk retrieval and as embedding keys in vector databases
- **`parentId`** *(required)*: Identifier for the parent document in format `{contentType}:{docName}`
  - Example: `"doc:skeleton"`
  - Links chunks back to their originating document for document-level operations
- **`chunkNumber`** *(required)*: Zero-based sequential position within the parent document
  - Example: `4` (indicates this is the 5th chunk in the document)
  - Used for ordering and reference

### Content Fields (Required)
- **`originalText`** *(required)*: Original markdown content for human display and presentation
  - Preserves all formatting, links, and markdown syntax exactly as processed
  - Used for presenting chunks to users in search results and UI displays
  - Contains the clean chunk content after normalization and overlap but before context prepending
  - Essential for maintaining readable, properly formatted content for end users

- **`embedText`** *(required)*: Processed text specifically optimized for vector embeddings and search
  - Built from `originalText` with contextual enhancements for better semantic understanding
  - May include contextual prefix with document title and section hierarchy
  - Cleaned and formatted for optimal vector database performance
  - This is the actual text that gets vectorized and indexed for retrieval
  - Example: `"Title: skeleton.txt\n\n### Base\n\nControls the style of the..."`

**Internal Processing Field:**
- **`content`** *(internal only)*: Used during pipeline processing. This is the working text that gets modified through various stages (normalization, overlap addition, etc.). This field is part of the basic `Chunk` type used internally but is not included in the final output.

**Why all three?**
- `content` allows flexible internal processing without affecting final output structure
- `originalText` preserves the clean chunk for display/rendering
- `embedText` optimizes for search with context while keeping display text clean

**Example showing the difference:**

For a chunk from a document titled "API Documentation" in the "Authentication > OAuth Setup" section:

```javascript
// originalText - clean markdown for display
"### OAuth Setup\n\nConfigure your OAuth provider:\n\n```javascript\nconst config = {\n  clientId: 'your-client-id',\n  redirectUri: 'https://example.com/callback'\n};\n```"

// embedText - enhanced for search with context
"API Documentation > Authentication > OAuth Setup\n\n### OAuth Setup\n\nConfigure your OAuth provider:\n\n```javascript\nconst config = {\n  clientId: 'your-client-id',\n  redirectUri: 'https://example.com/callback'\n};\n```"
```

**Key differences:**
- `originalText`: Preserves exact formatting for user presentation
- `embedText`: Adds contextual breadcrumb prefix for better search relevance


### Position and Token Data (Required)
- **`sourcePosition`** *(required)*: Character-based position information representing positions in the **original source text only**
  - `charStart`: Starting character position in source document
  - `charEnd`: Ending character position in source document
  - `totalChars`: Total character length of the original source document
  - Used for highlighting and precise content location
  - Derived from AST position data: `start.offset`, `end.offset`

- **`tokenStats`** *(required)*: Token counting information
  - `tokens`: Actual token count from tiktoken
  - `estimatedTokens`: Estimated token count using character heuristics

## Optional Fields

### Navigation
- **`prevId`**: ID of the previous chunk in sequence (null for first chunk)
  - Example: `"doc:skeleton::ch3"`
  - Enables sequential navigation through document chunks
  - `null` for the first chunk in a document
- **`nextId`**: ID of the next chunk in sequence (null for last chunk)
  - Example: `"doc:skeleton::ch5"`
  - Enables sequential navigation through document chunks
  - `null` for the last chunk in a document


### Pipeline Processing Information
- **`pipeline`**: Information about the processing pipeline
  - `version`: Version of the chunking pipeline
  - `processingTimeMs`: Time taken to process this chunk in milliseconds

### Metadata for Vector Database Filtering
- **`metadata`**: Structured information for vector database filtering and organization. This object contains all the fields that would be useful for filtering, querying, and organizing chunks in a vector database.
  - `contentType`: Type of source content (e.g., "doc", "post", "code")
  - `sourceFile`: Original filename that was processed (e.g., "skeleton.txt")
  - `fileTitle`: Document-level title passed as a required parameter
  - `sectionTitle`: The heading text of the current section (last value from headerPath)
  - `headerPath`: Array containing the hierarchical path of headings
  - `headerBreadcrumb`: Pre-formatted display string (headerPath joined with " > ")
  - `headerDepths`: Array of heading levels (1-6) corresponding to each entry in headerPath
  - `headerSlugs`: Array of URL-safe anchor IDs corresponding to each heading
  - `sectionSlug`: The URL-safe anchor ID for the current section
  - `nodeTypes`: Array of AST node type IDs that this chunk contains (e.g., ["paragraph", "list", "code", "table"])
  - `processedAt`: ISO8601 timestamp of when chunk was created
  - `chunkingOptions`: Configuration used for chunking

**Complete metadata example:**
```json
{
  "metadata": {
    "contentType": "doc",
    "sourceFile": "api-documentation.md",
    "fileTitle": "API Documentation",
    "sectionTitle": "OAuth Setup",
    "headerPath": ["Getting Started", "Authentication", "OAuth Setup"],
    "headerBreadcrumb": "Getting Started > Authentication > OAuth Setup",
    "headerDepths": [1, 2, 3],
    "headerSlugs": ["getting-started", "authentication", "oauth-setup"],
    "sectionSlug": "oauth-setup",
    "nodeTypes": ["paragraph", "code", "list"],
    "processedAt": "2024-01-15T10:30:00Z",
    "chunkingOptions": {
      "targetTokens": 400,
      "maxTokens": 512,
      "breadcrumbMode": "conditional"
    }
  }
}
```

**Additional optional fields from legacy format:**
- **`source`** *(optional)*: Source location information `{ filePath: string, startLine: number, endLine: number }`

**Important position data note:**
The `sourcePosition` data represents the original source document only and does NOT include:
- Breadcrumb prepending (which happens during `embedText` generation)
- Any normalization or cleaning changes
- Header path additions or modifications

This ensures offsets always map back to the original document positions for accurate source tracking and highlighting.

## Implementation Status

### ✅ Fully Implemented
**Pipeline Flow**: `parseMarkdown` → `flattenAst` → `splitOversized` → `packNodes` → `addOverlap` → `normalizeChunks` → `attachMetadata` → `generateEmbedText` → `assertOrFilterInvalid`

**Key Implementation Files**:
- `lib/index.ts`: Main pipeline orchestration with enhanced chunk output
- `lib/metadata.ts`: Complete metadata attachment with all enhanced fields
- `lib/types.ts`: Updated `Chunk` type definition matching this specification
- `lib/embed-text.ts`: Conditional breadcrumb generation system
- `lib/packer.ts`: Enhanced chunk creation with metadata preservation

**✅ Implementation Complete**: All enhanced fields and metadata structure implemented according to this specification.

### ✅ Type Definition Compliance

**Implementation Status:** The `Chunk` type in `lib/types.ts` has been fully updated to match this specification:

✅ **Completed Updates**:
- ✅ Enhanced metadata object with all filtering fields
- ✅ Structured `tokenStats` object replacing legacy `tokenCount`
- ✅ Pipeline information in dedicated `pipeline` object
- ✅ Complete source position tracking in `sourcePosition`
- ✅ All header-related fields: `headerPath`, `headerDepths`, `headerSlugs`, `sectionSlug`
- ✅ Content fields: `originalText`, `embedText` with conditional breadcrumbs

### Migration Notes for Existing Systems

If you're migrating from the legacy chunk format documented in `chunk-format-documentation.md`, use this mapping table:

| Legacy Field Name | New Field Name | Notes |
|------------------|----------------|-------|
| `displayMarkdown` | `originalText` | Same purpose: formatted content for display |
| `charOffsets` | `sourcePosition` | Object structure unchanged, clearer name |
| `charOffsets.sourceLength` | `sourcePosition.totalChars` | Renamed for consistency |
| `heading` | `metadata.sectionTitle` | Now in metadata object for filtering |
| `headerHierarchy` | `metadata.headerBreadcrumb` | Now in metadata object |
| `tokenCount` | `tokenStats.tokens` | Now part of structured token information object |
| `contentType` | `metadata.contentType` | Moved to metadata for vector DB filtering |

**New required fields** (not in legacy format):
- `metadata.fileTitle`: Document-level title (required parameter)
- `metadata.headerPath`: Array of heading texts
- `metadata.headerDepths`: Array of heading levels [1-6]
- `metadata.headerSlugs`: Array of URL-safe anchor IDs
- `metadata.sectionSlug`: Current section's anchor ID
- `metadata.sourceFile`: Original filename
- `metadata.processedAt`: Processing timestamp
- `metadata.chunkingOptions`: Configuration used
- `tokenStats.estimatedTokens`: Character-based token estimate
- `pipeline`: Processing information (version, timing)

**Breaking changes to be aware of:**
1. Most structural fields moved to `metadata` object for vector database filtering
2. `sourcePosition` excludes breadcrumb modifications (positions are source-only)
3. `metadata.headerBreadcrumb` never includes `fileTitle` (separated for clarity)
4. `fileTitle` is now a required parameter from calling code
5. Token information moved to structured `tokenStats` object
6. Pipeline information separated from metadata

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

## Chunking Strategy

### Token Limits
> **Note**: For current token limit defaults, see `lib/default-config.ts`
- **Target tokens**: ~400 average (configurable via `targetTokens`)
- **Token range**: 64-512 strict range (configurable via `minTokens` and `maxTokens`)
- **Overlap**: Configurable via `overlapSentences` parameter (default: 2 sentences) instead of token counts

### Context Enhancement
- Each chunk includes document title as prefix when needed
- Header hierarchy provides section context
- Previous/next linking enables document traversal
- Character offsets allow precise source highlighting

### Breadcrumb Context Options
The `breadcrumbMode` configuration controls when contextual breadcrumbs are prepended to `embedText`:

- **`"conditional"`** (default): Intelligently adds breadcrumbs based on context needs
  - Prepends full breadcrumb when chunk starts a new section (contains heading)
  - Prepends full breadcrumb for context-less chunks (code-only, table-only, list-only)
  - Prepends full breadcrumb for short chunks (< minTokens + overlap)
  - Prepends only fileTitle for middle-of-section prose when `fileTitle !== headerPath[0]`
  - Prepends nothing when chunk already starts with exact heading or when `fileTitle === headerPath[0]`

- **`"always"`**: Always prepends full breadcrumb context to every chunk
  - Format: `fileTitle > headerBreadcrumb` when `fileTitle !== headerPath[0]`
  - Format: `headerBreadcrumb` when `fileTitle === headerPath[0]`

- **`"none"`**: Never prepends any breadcrumb context
  - `embedText` equals `originalText` in all cases

**Example breadcrumb formats:**
- Full context: `"API Documentation > Getting Started > Authentication > OAuth Setup"`
- Header only: `"Getting Started > Authentication > OAuth Setup"` (when fileTitle matches first header)
- File only: `"API Documentation"` (for middle-section prose)
- None: No prefix added

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

### Next Steps

1. **Update implementation** in lib/types.ts and related files to match the merged specification
2. **Test** the implementation against the documented format

### Key File Locations for Reference
- Current implementation types: `lib/types.ts` (see `EnhancedChunk` type)
- Metadata attachment: `lib/metadata.ts` (lines 119-150 for current implementation)
- Default configuration: `lib/default-config.ts` (token limits and options)
- Main pipeline: `lib/index.ts` (orchestration of all stages)
- Implementation reference: `docs/title-in-each-chunk.md` (fully implemented breadcrumb system)

### ✅ Implementation Complete

**CURRENT STATE**: The specification in this document has been fully implemented. The chunker now produces enhanced chunks matching this exact specification.

**✅ ALL TASKS COMPLETED**:
1. ✅ Updated `Chunk` type in `lib/types.ts` to match this spec exactly
2. ✅ Updated `lib/metadata.ts` to generate metadata object with all structural fields
3. ✅ Added `fileTitle` parameter to main chunking function signature
4. ✅ Implemented breadcrumb generation logic (`embedText` vs `originalText`)
5. ✅ Added `breadcrumbMode` option to `ChunkOptions`
6. ✅ Moved all filtering-relevant fields into metadata object
7. ✅ Separated pipeline information from metadata
8. ✅ Added comprehensive test coverage for all functionality

**PIPELINE FLOW**: The current pipeline returns fully enhanced `Chunk[]` matching this specification exactly.
