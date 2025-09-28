# Title and Header Fields in Chunks

This document defines the specification for how titles and headers are handled during chunk processing, particularly focusing on breadcrumb generation and context prepending.

> **Note**: For the complete output format specification including all field definitions, see [`chunk-output-format.md`](./chunk-output-format.md).

## Overview: Metadata vs Embedded Text

This specification maintains a clear separation between:

1. **Metadata Fields** - Pure structural data stored for programmatic access (never modified based on context)
2. **Embedded Text** - The actual chunk content that may have context prepended for better comprehension

The distinction between `originalText`, `embedText`, and internal `content` fields is detailed in [`chunk-output-format.md`](./chunk-output-format.md#content-fields).

## Key Header-Related Fields

The following header-related fields are defined in [`chunk-output-format.md`](./chunk-output-format.md) and are central to this specification:

* **`fileTitle`** (required) – Document-level title passed as a parameter, kept separate from heading hierarchy
* **`headerPath`** – Array of heading texts forming the hierarchical path
* **`headerBreadcrumb`** – Pre-joined display string (`headerPath.join(" > ")`), never includes `fileTitle`
* **`headerDepths`** – Array of heading levels (1-6) for each headerPath entry
* **`headerSlugs`** – URL-safe anchor IDs for each heading
* **`sectionSlug`** – Anchor ID for current section
* **`sectionTitle`** – Text of current section heading

These fields are **always consistent** and **never modified** based on embedding conditions. See the full field descriptions in the output format documentation.

### Implementation Notes

* **No markdown prefixes**: Store only text in `headerPath`, not `#` symbols
* **Array vs string**: Keep both forms - array for manipulation (`headerPath`), string for display/search (`headerBreadcrumb`)
* **Separator consistency**: Always use `" > "` for `headerBreadcrumb`
* **Future enhancement (not for current implementation)**: In the future, if needed, `headerPath` could use objects for richer metadata:
  ```json
  "headerPath": [
    { "text": "Individual Chunk File Output Format", "depth": 1 },
    { "text": "Field Descriptions", "depth": 2 }
  ]
  ```
  For now, keep `headerPath` as a simple string array with depth tracked separately in `headerDepths`.

## Separation of Concerns

### Metadata Fields (Always Consistent)
* **`fileTitle`** - Document-level title, stored separately
* **`headerPath`** - Array of headings starting from first H1 in document
* **`headerBreadcrumb`** - Always `headerPath.join(" > ")`, never includes `fileTitle`

### Embedded Text (Context-Dependent)
* The actual chunk content that gets embedded in vector databases
* May have breadcrumb context prepended based on conditions
* Uses a **separate computed property** for the final embedded text

## Title vs H1 Handling

* Keep **both** in metadata: `fileTitle` (document title) and `headerPath` (starting at first H1 in file)
* Build `headerBreadcrumb` from `headerPath` only (always exclude `fileTitle`)
* When generating embedded text: conditionally prepend context, but **never modify the metadata fields**

## Embedded Text Rules

The final embedded text is generated separately from metadata. Use a conditional approach to balance context preservation with token efficiency.

### Example Scenarios

**Scenario 1: Middle of section prose**
- Input: Regular paragraph in the middle of a section
- fileTitle: "API Documentation"
- headerPath: ["API Documentation", "Authentication", "OAuth Setup"]
- Decision: No breadcrumb needed (clear context from flow)
- embedText: `[original chunk text]`

**Scenario 2: Section start with heading**
- Input: Chunk starting with "### OAuth Setup"
- fileTitle: "API Documentation"
- headerPath: ["API Documentation", "Authentication", "OAuth Setup"]
- Decision: Prepend full breadcrumb (new section)
- embedText: `API Documentation > Authentication > OAuth Setup\n\n### OAuth Setup\n[rest of chunk]`

**Scenario 3: Isolated code block**
- Input: Code-only chunk with no prose
- fileTitle: "API Documentation"
- headerPath: ["API Documentation", "Authentication", "OAuth Setup"]
- Decision: Prepend full breadcrumb (lacks context)
- embedText: `API Documentation > Authentication > OAuth Setup\n\n\`\`\`javascript\n[code]\n\`\`\``

**Scenario 4: Short chunk**
- Input: 150-token chunk
- fileTitle: "API Documentation"
- Options: minTokens=200, overlapTokens=50
- Decision: Prepend breadcrumb (below minTokens threshold)
- embedText: `API Documentation > Authentication > OAuth Setup\n\n[chunk text]`

### Context Generation Process

**Step 1: Build Context Strings**
```javascript
const headerBreadcrumb = headerPath.join(" > ")  // metadata field, never changes
const fullBreadcrumb = fileTitle !== headerPath[0]
  ? fileTitle + " > " + headerBreadcrumb
  : headerBreadcrumb
```

**Step 2: Determine Context Need**
1. **Prepend full breadcrumb when**:
   - Chunk starts a new section (contains heading node)
   - Chunk lacks context (code-only, table-only, list-only)
   - Chunk is short (< `minTokens` + overlap)

2. **Prepend only fileTitle when**:
   - Middle-of-section prose with clear flow
   - Only if `fileTitle !== headerPath[0]`

3. **Prepend nothing when**:
   - Chunk already starts with the exact heading
   - `fileTitle === headerPath[0]` and not a special case

**Step 3: Generate Final Embedded Text**
```javascript
let embedText = chunkContent
if (needsFullContext) {
  embedText = fullBreadcrumb + "\n\n" + chunkContent
} else if (needsFileTitle) {
  embedText = fileTitle + "\n\n" + chunkContent
}
// Store in chunk.embedText or similar field
```

### Key Principle
The `headerBreadcrumb` metadata field **never changes**. Context prepending only affects the final embedded text output.

### Formatting Rules

* **Deduplication**: Never add if chunk already starts with exact heading
* **Length limit**: Cap at 160 chars (truncate middle segments with `…`, keep first/last)
* **Format**: Plain text line + blank line:

  ```
  Document Title > API Reference > Authentication

  [chunk text...]
  ```

### Implementation Notes

* **Metadata stays pure**: `headerBreadcrumb` is always `headerPath.join(" > ")` regardless of embedding context
* **Separate embedding logic**: Context prepending happens in a separate function/module that reads metadata but doesn't modify it
* **Clear data flow**: `metadata.headerBreadcrumb` → `embedText` generation → final chunk output
* **Character positions represent original text only**: The `sourcePosition` in metadata represent positions in the original source document. They should NOT include:
  - Breadcrumb prepending (which happens during output formatting)
  - Any normalization or cleaning changes
  - Header path additions

  This ensures offsets always map back to the original document positions for accurate source tracking.

## Edge Cases

* **No H1 present**: `headerPath` starts at first heading found; still prepend `fileTitle`
* **Multiple H1s**: First H1 is document root; later H1s start new top-level sections
* **Frontmatter title**: Use as `fileTitle` only; don't modify `headerPath`. Used in `fullBreadcrumb`.
* If there are no headings at all: use fileTitle as sectionTitle, do not add to `headerPath` or `headerBreadcrumb`. Those are always derived only from headerPath, never from fileTitle.

## Rationale

This conditional approach:
* Controls token overhead (avoids repeating long trails unnecessarily)
* Provides disambiguation where needed (section starts, isolated code/tables)
* Maintains clean reading experience for continuous prose
* Can be toggled via `options.breadcrumbMode: "conditional" | "always" | "none"` (default: `"conditional"`)

### Notes on Implementation

**Type System:**
- The `Chunk` type is used throughout the pipeline with flexible metadata
- The metadata fields are populated in `lib/metadata.ts` during the `attachMetadata` stage
- All specified fields are added to the metadata object:
  - `fileTitle` - passed as parameter to `chunkMarkdown`
  - `headerPath` - array of heading texts (internally uses `headingTrail` from flatten-ast)
  - `headerBreadcrumb` - pre-joined string with `" > "` separator
  - `headerDepths` - array tracking depth of each heading
  - `headerSlugs` - array of URL-safe anchor IDs
  - `sectionSlug` - anchor ID for current section
  - `sectionTitle` - text of current section heading

## Key Implementation Files

The specification described in this document is implemented across the following files:

1. **Core Metadata Fields** (`lib/metadata.ts`)
   - Accepts `fileTitle` parameter and stores it in metadata
   - Generates `headerPath`, `headerBreadcrumb`, `headerDepths`, `headerSlugs`
   - Extracts `sectionTitle` and `sectionSlug` for current section
   - Links chunks with `prevId`/`nextId` for navigation

2. **Header Path Building** (`lib/flatten-ast.ts`)
   - Builds `headingTrail` array while flattening the AST
   - Tracks heading depths alongside the heading text
   - Properly handles heading hierarchy (H1-H6)
   - Maintains clean heading text without markdown symbols

3. **Text Embedding with Breadcrumbs** (`lib/embed-text.ts`)
   - Implements conditional breadcrumb prepending logic
   - Detects context-less chunks (code-only, table-only, list-only)
   - Handles short chunks below minTokens threshold
   - Truncates breadcrumbs to 160 characters with middle ellipsis
   - Supports three modes: "conditional", "always", "none"

4. **Configuration Options** (`lib/types.ts`, `lib/default-config.ts`)
   - Defines `breadcrumbMode` option in ChunkOptions type
   - Sets default to "conditional" for optimal balance
   - Configurable via options parameter

5. **Main Pipeline** (`lib/index.ts`)
   - Requires `fileTitle` as parameter to `chunkMarkdown()` function
   - Passes fileTitle through pipeline to metadata stage
   - Orchestrates all processing stages in correct order

6. **Slug Generation** (`lib/slug-utils.ts`)
   - Uses github-slugger library for GitHub-compatible anchor IDs
   - Maintains state to ensure unique slugs across document
   - Handles slug collisions with automatic numbering
   - Provides reset functionality for new documents

7. **Supporting Utilities** (`lib/markdown-utils.ts`)
   - Extracts clean heading text from markdown
   - Detects node types for metadata
   - Provides helper functions for content analysis
