# Title and Header Fields in Chunks

This document defines the authoritative specification for how titles and headers are stored in chunk metadata and embedded in chunk text.

## Overview: Metadata vs Embedded Text

This specification maintains a clear separation between:

1. **Metadata Fields** - Pure structural data stored for programmatic access (never modified based on context)
2. **Embedded Text** - The actual chunk content that may have context prepended for better comprehension

## Metadata Fields

Store comprehensive header information in metadata for programmatic use and retrieval. These fields are **always consistent** and **never modified** based on embedding conditions:

### Required Fields

* **`fileTitle`** `string` – Document-level title passed as a parameter to the chunking function. The calling code is responsible for extracting this from frontmatter, first H1, filename, or any other source. This represents the overall document and is kept separate from the heading hierarchy.

* **`headerPath`** `string[]` – Array containing the hierarchical path of headings from the document root to the current section. Contains only the heading text without markdown syntax (`#` marks). Starts from the first heading in the document (usually H1) and includes all parent headings down to the current section.
  - Example: `["API Documentation", "Authentication", "OAuth2 Setup"]`

* **`headerBreadcrumb`** `string` – Pre-formatted display string created by joining `headerPath` with `" > "` separator. This is **always** just the header path and **never** includes `fileTitle`. Used for human-readable context in search results and navigation.
  - Example: `"API Documentation > Authentication > OAuth2 Setup"`
  - **Important**: This field is pure metadata and is never modified for embedding purposes

* **`headerDepths`** `number[]` – Array of heading levels (1-6) corresponding to each entry in `headerPath`. Useful for understanding the document structure and hierarchy depth.
  - Example: `[1, 2, 3]` for H1, H2, H3

* **`headerSlugs`** `string[]` – Array of URL-safe anchor IDs corresponding to each heading in `headerPath`. Used for generating links and navigation within the document.
  - Example: `["api-documentation", "authentication", "oauth2-setup"]`

* **`sectionSlug`** `string` – The URL-safe anchor ID for the current section (typically the slug of the last `headerPath` entry). Used for direct linking to this specific chunk's section.

* **`sectionTitle`** `string` – The heading text of the current section (last value from `headerPath`). Provides quick access to the immediate section context without array manipulation.

### Example

```json
{
  "fileTitle": "Individual Chunk File Output Format",
  "headerPath": [
    "Individual Chunk File Output Format",
    "Field Descriptions",
    "Token Information"
  ],
  "headerBreadcrumb": "Individual Chunk File Output Format > Field Descriptions > Token Information",
  "headerDepths": [1, 2, 3],
  "headerSlugs": [
    "individual-chunk-file-output-format",
    "field-descriptions",
    "token-information"
  ],
  "sectionSlug": "token-information",
  "sectionTitle": "Token Information"
}
```

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
  - [ ] Add `fileTitle?: string` parameter to main chunking function
  - [ ] Pass fileTitle through pipeline to metadata stage
  - [ ] Document that calling code handles frontmatter/title extraction

- [ ] **Add slug generation** (using github-slugger library)
  - [ ] Install github-slugger dependency
  - [ ] Generate slugs for each heading in headerPath
  - [ ] Store in headerSlugs array
  - [ ] Use last slug as sectionSlug

### Questions Requiring Clarification

1. **EnhancedChunk type**: Should we update the existing type definition to match spec exactly?
2. **Function signature**: Should `fileTitle` be optional or required parameter in the main chunking function?

### Testing Requirements

- [ ] Add tests for fileTitle parameter handling (present vs absent)
- [ ] Add tests for headerBreadcrumb building with separator
- [ ] Add tests for breadcrumb prepending logic (all conditions)
- [ ] Add tests for edge cases (no H1, multiple H1s, no headings)
- [ ] Add tests for truncation at 160 chars
- [ ] Update existing tests that may break with new metadata fields
- [ ] Test sectionTitle extraction (last item from headerPath)
- [ ] Test headerDepths array generation
- [ ] Test github-slugger integration for headerSlugs and sectionSlug
- [ ] Test slug collision handling (github-slugger auto-appends numbers)
