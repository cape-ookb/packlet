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
* **Character offsets represent original text only**: The `charOffsets` in metadata represent positions in the original source document. They should NOT include:
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

## Implementation TODO List

### High Priority - Core Metadata Fields

- [ ] **Add missing metadata fields** (lib/metadata.ts:119-150)
  - [ ] Accept `fileTitle` as parameter from calling code
  - [ ] Rename existing `headerPath` to match spec (currently using `headingTrail`)
  - [ ] Add `headerBreadcrumb` as pre-joined string with `" > "` separator
  - [ ] Add `headerDepths` array tracking depth of each heading in path
  - [ ] Add `headerSlugs` array for anchor IDs
  - [ ] Add `sectionSlug` as slug of current section
  - [ ] Add `sectionTitle` field for current section (last value from headerPath)
  - [ ] Replace deprecated `heading` field with `sectionTitle` throughout codebase

### High Priority - Header Path Logic

- [ ] **Fix header path building** (lib/flatten-ast.ts)
  - [ ] Ensure headerPath contains only actual headings from document (no `#` marks)
  - [ ] Keep headerPath separate from fileTitle (don't mix them)
  - [ ] Properly handle multiple H1s (first is root, later ones start new sections)
  - [ ] Handle edge case when no H1 present (start at first heading found)

### Medium Priority - Text Embedding Rules

- [ ] **Implement conditional breadcrumb prepending** (new module: lib/embed-text.ts)
  - [ ] Create separate function that reads metadata but doesn't modify it
  - [ ] Detect when chunk starts new section (contains heading node)
  - [ ] Detect context-less chunks (code-only, table-only, list-only)
  - [ ] Detect short chunks (< minTokens + overlap)
  - [ ] Build fullBreadcrumb when fileTitle !== headerPath[0]
  - [ ] Add deduplication logic (don't add if chunk starts with exact heading)
  - [ ] Implement 160-char truncation with middle ellipsis
  - [ ] Generate final embedText field without modifying metadata

- [ ] **Add breadcrumbMode option** (lib/types.ts, lib/default-config.ts)
  - [ ] Add to ChunkOptions type: `breadcrumbMode?: "conditional" | "always" | "none"`
  - [ ] Set default to "conditional" in default config
  - [ ] Implement mode switching logic in embedding function

### Low Priority - Edge Cases & Polish

- [ ] **Update function signatures** (lib/index.ts, lib/metadata.ts)
  - [ ] Add `fileTitle: string` parameter (required) to main chunking function
  - [ ] Pass fileTitle through pipeline to metadata stage
  - [ ] Document that calling code handles frontmatter/title extraction

- [ ] **Add slug generation** (using github-slugger library)
  - [ ] Install github-slugger dependency
  - [ ] Generate slugs for each heading in headerPath
  - [ ] Store in headerSlugs array
  - [ ] Use last slug as sectionSlug

### Type Definition Updates Required

**Current state in lib/types.ts:**
- Has basic `Chunk` type with: `content`, `tokens`, `metadata?: Record<string, any>`
- Has separate `EnhancedChunk` type that partially matches the spec

**Required changes to `EnhancedChunk`:**
- Rename `displayMarkdown` to `originalText` (stores the original chunk content before any modifications)
- Keep `embedText` field (this is what actually gets encoded/embedded in vector databases - may have breadcrumbs prepended)
- Add missing metadata fields:
  - `fileTitle` field
  - `headerBreadcrumb` field (pre-joined string)
  - `headerDepths` array
  - `headerSlugs` array
  - `sectionSlug` field
  - `sectionTitle` field

**Implementation approach:** Update `EnhancedChunk` to include all spec fields and use it as the output type, while keeping `Chunk` simple for internal pipeline processing

### Testing Requirements

- [ ] Add tests for fileTitle parameter handling (required parameter validation)
- [ ] Add tests for headerBreadcrumb building with separator
- [ ] Add tests for breadcrumb prepending logic (all conditions)
- [ ] Add tests for edge cases (no H1, multiple H1s, no headings)
- [ ] Add tests for truncation at 160 chars
- [ ] Update existing tests that may break with new metadata fields
- [ ] Test sectionTitle extraction (last item from headerPath)
- [ ] Test headerDepths array generation
- [ ] Test github-slugger integration for headerSlugs and sectionSlug
- [ ] Test slug collision handling (github-slugger auto-appends numbers)
