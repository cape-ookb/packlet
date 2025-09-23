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
  // Required core identifiers
  "id": "doc:{docName}::ch{chunkNumber}",
  "parentId": "doc:{docName}",
  "chunkNumber": number,
  "contentType": "doc",

  // Required content fields
  "embedText": "string",
  "originalText": "string",

  // Required structural information
  "fileTitle": "string",
  "sectionTitle": "string",
  "headerPath": ["string"],
  "headerBreadcrumb": "string",
  "headerDepths": [number],
  "headerSlugs": ["string"],
  "sectionSlug": "string",

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

  // Optional navigation
  "prevId": "doc:{docName}::ch{prevNumber}" | null,
  "nextId": "doc:{docName}::ch{nextNumber}" | null,

  // Optional content analysis
  "nodeTypes": ["paragraph", "list", "code"],

  // Optional processing metadata
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
- **`contentType`** *(required)*: Type of source content
  - Example: `"doc"` for documentation, `"post"` for blog posts
  - Enables content-type-specific processing and filtering

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

### Structural Information (Required)
- **`fileTitle`** *(required)*: Document-level title passed as a required parameter to the chunking function. The calling code is responsible for extracting this from frontmatter, first H1, filename, or any other source
  - Example: `"API Documentation"`

- **`sectionTitle`** *(required)*: The heading text of the current section (last value from `headerPath`). Most relevant heading found in the chunk. Empty string if no heading is found.
  - Example: `"OAuth Setup"`

- **`headerPath`** *(required)*: Array containing the hierarchical path of headings from the document root to the current section. Contains only heading text without markdown syntax. Provides full document context for the chunk's position.
  - Example: `["Getting Started", "Authentication", "OAuth Setup"]`

- **`headerBreadcrumb`** *(required)*: Pre-formatted display string created by joining `headerPath` with `" > "` separator. Never includes `fileTitle`. Used for contextual understanding and navigation.
  - Example: `"Getting Started > Authentication > OAuth Setup"`

- **`headerDepths`** *(required)*: Array of heading levels (1-6) corresponding to each entry in `headerPath`
  - Example: `[1, 2, 3]` (H1, H2, H3 headings respectively)

- **`headerSlugs`** *(required)*: Array of URL-safe anchor IDs corresponding to each heading in `headerPath`
  - Example: `["getting-started", "authentication", "oauth-setup"]`

- **`sectionSlug`** *(required)*: The URL-safe anchor ID for the current section
  - Example: `"oauth-setup"` (last value from `headerSlugs`)

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

### Navigation (Optional)
- **`prevId`** *(optional)*: ID of the previous chunk in sequence (null for first chunk)
  - Example: `"doc:skeleton::ch3"`
  - Enables sequential navigation through document chunks
  - `null` for the first chunk in a document
- **`nextId`** *(optional)*: ID of the next chunk in sequence (null for last chunk)
  - Example: `"doc:skeleton::ch5"`
  - Enables sequential navigation through document chunks
  - `null` for the last chunk in a document

### Content Analysis (Optional)
- **`nodeTypes`** *(optional)*: Array of AST node type IDs that this chunk contains
  - Example: `["paragraph", "list", "code", "table"]`
  - Indicates the structural composition of the chunk content
  - Useful for content-aware processing and filtering

**Complete header example:**
```json
{
  "fileTitle": "API Documentation",
  "sectionTitle": "OAuth Setup",
  "headerPath": ["Getting Started", "Authentication", "OAuth Setup"],
  "headerBreadcrumb": "Getting Started > Authentication > OAuth Setup",
  "headerDepths": [1, 2, 3],
  "headerSlugs": ["getting-started", "authentication", "oauth-setup"],
  "sectionSlug": "oauth-setup"
}
```

### Processing Metadata (Optional)
- **`metadata`** *(optional)*: Processing and provenance information
  - `sourceFile`: Original filename that was processed (e.g., `"skeleton.txt"`)
  - `processedAt`: ISO8601 timestamp of when chunk was created
  - `chunkingOptions`: Configuration used for chunking
  - `pipeline`: Version and performance information
  - Additional fields vary by content type (title, date, tags, etc.)

**Additional optional fields from legacy format:**
- **`source`** *(optional)*: Source location information `{ filePath: string, startLine: number, endLine: number }`

**Important position data note:**
The `sourcePosition` data represents the original source document only and does NOT include:
- Breadcrumb prepending (which happens during `embedText` generation)
- Any normalization or cleaning changes
- Header path additions or modifications

This ensures offsets always map back to the original document positions for accurate source tracking and highlighting.

## Implementation Status

### Current Pipeline Status
**Pipeline Flow**: `parseMarkdown` → `flattenAst` → `splitOversized` → `packNodes` → `addOverlap` → `normalizeChunks` → `attachMetadata` → `assertOrFilterInvalid`

**Key Implementation Files**:
- `lib/index.ts`: Main pipeline orchestration
- `lib/metadata.ts`: Metadata attachment (needs updates per this spec)
- `lib/types.ts`: Type definitions (has `Chunk` and partial `EnhancedChunk`)
- `lib/packer.ts`: Creates initial chunks with `content` field

**Implementation Gap**: Currently using basic `Chunk` type with untyped metadata. `EnhancedChunk` exists but needs updates to match this spec.

### Required Type Updates

**Implementation Note:**
The current `EnhancedChunk` type in `lib/types.ts` uses legacy field names and is missing several fields documented here. The type definition needs to be updated to match this specification:

Required updates to `EnhancedChunk` type:
- Rename `displayMarkdown` → `originalText`
- Rename `charOffsets` → `sourcePosition`
- Rename `sourceLength` → `totalChars` (within position object)
- Rename `heading` → `sectionTitle`
- Add missing fields: `fileTitle`, `headerBreadcrumb`, `headerDepths`, `headerSlugs`, `sectionSlug`
- Update `tokenCount` → `tokenStats.tokens` object structure

### Migration Notes for Existing Systems

If you're migrating from the legacy chunk format documented in `chunk-format-documentation.md`, use this mapping table:

| Legacy Field Name | New Field Name | Notes |
|------------------|----------------|-------|
| `displayMarkdown` | `originalText` | Same purpose: formatted content for display |
| `charOffsets` | `sourcePosition` | Object structure unchanged, clearer name |
| `charOffsets.sourceLength` | `sourcePosition.totalChars` | Renamed for consistency |
| `heading` | `sectionTitle` | Same purpose: current section heading text |
| `headerHierarchy` | `headerBreadcrumb` | Same format: `" > "` separated string |
| `tokenCount` | `tokenStats.tokens` | Now part of structured token information object |

**New required fields** (not in legacy format):
- `fileTitle`: Document-level title (required parameter)
- `headerDepths`: Array of heading levels [1-6]
- `headerSlugs`: Array of URL-safe anchor IDs
- `sectionSlug`: Current section's anchor ID
- `tokenStats.estimatedTokens`: Character-based token estimate

**Breaking changes to be aware of:**
1. `sourcePosition` excludes breadcrumb modifications (positions are source-only)
2. `headerBreadcrumb` never includes `fileTitle` (separated for clarity)
3. `fileTitle` is now a required parameter from calling code
4. Token information moved to structured `tokenStats` object

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
- Implementation TODOs: `docs/title-in-each-chunk.md` (lines 175-256)

### Critical Implementation Context for Next Phase

**CURRENT STATE**: The specification in this document represents the target state, but the actual implementation in the codebase still uses legacy field names and is missing many fields.

**KEY MISMATCHES TO FIX**:
1. `EnhancedChunk` type uses `displayMarkdown` → should be `originalText`
2. `EnhancedChunk` type uses `charOffsets` → should be `sourcePosition`
3. `EnhancedChunk` type uses `heading` → should be `sectionTitle`
4. Current implementation uses `headingTrail` → should be `headerPath`
5. Missing fields: `fileTitle`, `headerBreadcrumb`, `headerDepths`, `headerSlugs`, `sectionSlug`, `tokenStats` object

**MAIN IMPLEMENTATION TASKS**:
1. Update `EnhancedChunk` type in `lib/types.ts` to match this spec exactly
2. Update `lib/metadata.ts` to generate new field names and missing fields
3. Add `fileTitle` parameter to main chunking function signature
4. Implement breadcrumb generation logic (`embedText` vs `originalText`)
5. Add `breadcrumbMode` option to `ChunkOptions`

**PIPELINE FLOW**: The current pipeline returns basic `Chunk[]` but should return `EnhancedChunk[]` matching this specification.
