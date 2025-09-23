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
  "sourcePosition": {
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

Each chunk represents a semantically meaningful segment of content (typically from markdown documents) optimized for vector embedding and retrieval.

### Core Identifiers
- **`id`**: Unique identifier for this chunk in format `{contentType}:{docName}::ch{number}`
  - Example: `"doc:skeleton::ch4"`
  - Used for direct chunk retrieval and as embedding keys in vector databases
- **`parentId`**: Identifier for the parent document in format `{contentType}:{docName}`
  - Example: `"doc:skeleton"`
  - Links chunks back to their originating document for document-level operations
- **`prevId`**: ID of the previous chunk in sequence (null for first chunk)
  - Example: `"doc:skeleton::ch3"`
  - Enables sequential navigation through document chunks
  - `null` for the first chunk in a document
- **`nextId`**: ID of the next chunk in sequence (null for last chunk)
  - Example: `"doc:skeleton::ch5"`
  - Enables sequential navigation through document chunks
  - `null` for the last chunk in a document

### Content Fields

**Three distinct content fields serve different purposes:**

- **`content`** (internal): Used during pipeline processing. This is the working text that gets modified through various stages (normalization, overlap addition, etc.). This field is part of the basic `Chunk` type used internally but is not included in the final output.

- **`originalText`**: Original markdown content for human display and presentation
  - Preserves all formatting, links, and markdown syntax exactly as processed
  - Used for presenting chunks to users in search results and UI displays
  - Contains the clean chunk content after normalization and overlap but before context prepending
  - Essential for maintaining readable, properly formatted content for end users

- **`embedText`**: Processed text specifically optimized for vector embeddings and search
  - Built from `originalText` with contextual enhancements for better semantic understanding
  - May include contextual prefix with document title and section hierarchy
  - Cleaned and formatted for optimal vector database performance
  - This is the actual text that gets vectorized and indexed for retrieval
  - Example: `"Title: skeleton.txt\n\n### Base\n\nControls the style of the..."`

**Why all three?**
- `content` allows flexible internal processing without affecting final output structure
- `originalText` preserves the clean chunk for display/rendering
- `embedText` optimizes for search with context while keeping display text clean

Additional fields:
- **`chunkNumber`**: Zero-based sequential position within the parent document
  - Example: `4` (indicates this is the 5th chunk in the document)
  - Used for ordering and reference
- **`contentType`**: Type of source content
  - Example: `"doc"` for documentation, `"post"` for blog posts
  - Enables content-type-specific processing and filtering

### Structural Information
- **`fileTitle`** (required): Document-level title passed as a required parameter to the chunking function. The calling code is responsible for extracting this from frontmatter, first H1, filename, or any other source
- **`sectionTitle`**: The heading text of the current section (last value from `headerPath`). Most relevant heading found in the chunk. Empty string if no heading is found.
- **`headerPath`**: Array containing the hierarchical path of headings from the document root to the current section. Contains only heading text without markdown syntax. Provides full document context for the chunk's position.
  - Example: `["Typography", "Semantic Typography", "Base"]`
- **`headerBreadcrumb`**: Pre-formatted display string created by joining `headerPath` with `" > "` separator. Never includes `fileTitle`. Used for contextual understanding and navigation.
- **`headerDepths`**: Array of heading levels (1-6) corresponding to each entry in `headerPath`
- **`headerSlugs`**: Array of URL-safe anchor IDs corresponding to each heading in `headerPath`
- **`sectionSlug`**: The URL-safe anchor ID for the current section

**Field name changes:**
- **`heading`**: Primary heading that applies to this chunk (renamed to `sectionTitle`)
- **`headerHierarchy`**: String representation of heading hierarchy (renamed to `headerBreadcrumb`)

### Position Data
- **`sourcePosition`**: Character-based position information representing positions in the **original source text only** (not including breadcrumbs or normalizations)
  - `charStart`: Starting character position in source document
  - `charEnd`: Ending character position in source document
  - `totalChars`: Total character length of the original source document
  - Used for highlighting and precise content location
  - Derived from AST position data: `start.offset`, `end.offset`

### Token Information
- **`tokenStats`**: Token counting information
  - `tokens`: Actual token count from tiktoken
  - `estimatedTokens`: Estimated token count using character heuristics

### Processing Metadata
- **`metadata`**: Processing and provenance information
  - `sourceFile`: Original filename that was processed (e.g., `"skeleton.txt"`)
  - `processedAt`: ISO8601 timestamp of when chunk was created
  - `chunkingOptions`: Configuration used for chunking
  - `pipeline`: Version and performance information
  - Additional fields vary by content type (title, date, tags, etc.)

**Additional fields from legacy format:**
- **`nodeTypes`**: Array of AST node type IDs this chunk contains (`'paragraph'`, `'list'`, `'code'`, `'table'`)
- **`source`**: Source location information `{ filePath: string, startLine: number, endLine: number }`

**Field name changes:**
- **`tokenCount`**: Single token count number (renamed to `tokenStats.tokens` object structure)

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

## Documentation Merge Task List

### Context
This task list guides the consolidation of two chunk format documentation files:
- **Source (legacy)**: `docs/chunk-format-documentation.md` - older format specification with useful examples
- **Target (current)**: `docs/chunk-output-format.md` (this file) - the canonical specification going forward
- **Requirements source**: `docs/title-in-each-chunk.md` - contains implementation TODOs that define required fields

The goal is to merge all valuable content from the legacy document into this one while ensuring consistency with the current implementation and planned enhancements.

### Tasks for Merging chunk-format-documentation.md into this Document

#### Field Standardization Tasks ✅ COMPLETED

#### Content Migration Tasks ✅ COMPLETED

All content migration tasks have been completed:
- ✅ Migrated concrete examples with actual values (e.g., `"doc:skeleton::ch4"` for ID format)
- ✅ Incorporated detailed purpose descriptions for fields with more context about their use cases
- ✅ Added the "Chunking Strategy" context section with updated token limits to current defaults
- ✅ Preserved AST position derivation note: "Derived from AST position data: start.offset, end.offset"

- [ ] **Add missing field documentation**
  - [ ] Document `nodeTypes` array if implementation requires it
  - [ ] Add examples showing the difference between `embedText` and `originalText`
  - [ ] Include examples of `headerPath`, `headerBreadcrumb`, and slug fields

#### Implementation Alignment Tasks

- [ ] **Align with title-in-each-chunk.md requirements**
  - [ ] Add all metadata fields from TODO list (title-in-each-chunk.md lines 177-186):
    - [ ] `fileTitle` (required param from calling code, not derived from content)
    - [ ] `headerBreadcrumb` (pre-joined `headerPath.join(" > ")`, never includes fileTitle)
    - [ ] `headerDepths` (array of numbers 1-6 for each heading in headerPath)
    - [ ] `headerSlugs` (URL-safe IDs using github-slugger for each heading)
    - [ ] `sectionSlug` (last value from headerSlugs)
    - [ ] `sectionTitle` (last value from headerPath, replaces `heading`)
  - [ ] Document `breadcrumbMode` option: "conditional" (default) | "always" | "none"
  - [ ] Add note: sourcePosition excludes breadcrumbs/normalizations (per line 151 title-in-each-chunk.md)

#### Documentation Structure Tasks

- [ ] **Reorganize merged content**
  - [ ] Create clear sections for required vs optional fields
  - [ ] Group related fields (identifiers, content, position, metadata)
  - [ ] Add "Implementation Status" section if needed
  - [ ] Include migration notes for systems using old field names

- [ ] **Update cross-references**
  - [ ] Update README.md to reference only this merged document
  - [ ] Mark chunk-format-documentation.md as deprecated
  - [ ] Add deprecation notice to chunk-format-documentation.md pointing here

#### Validation Tasks

- [ ] **Verify consistency across documentation**
  - [ ] Ensure all field names match `EnhancedChunk` type in `lib/types.ts`
  - [ ] Cross-check with actual output from the chunking pipeline (`lib/index.ts`)
  - [ ] Validate JSON structure examples are complete and accurate
  - [ ] Confirm all TODO items from title-in-each-chunk.md (lines 175-256) are addressed
  - [ ] Check that field descriptions match implementation in `lib/metadata.ts`

### Next Steps

1. **Review and prioritize** the task list above
2. **Execute tasks** systematically, checking off completed items
3. **Archive or deprecate** chunk-format-documentation.md once merge is complete
4. **Update implementation** in lib/types.ts and related files to match the merged specification
5. **Test** the implementation against the documented format

### Key File Locations for Reference
- Current implementation types: `lib/types.ts` (see `EnhancedChunk` type)
- Metadata attachment: `lib/metadata.ts` (lines 119-150 for current implementation)
- Default configuration: `lib/default-config.ts` (token limits and options)
- Main pipeline: `lib/index.ts` (orchestration of all stages)
- Implementation TODOs: `docs/title-in-each-chunk.md` (lines 175-256)