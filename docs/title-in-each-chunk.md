# Title and Header Fields in Chunks

This document defines the authoritative specification for how titles and headers are stored in chunk metadata and embedded in chunk text.

## Metadata Fields

Store comprehensive header information in metadata for programmatic use and retrieval:

### Required Fields

* **`fileTitle`** `string` – Document title from frontmatter, H1, filename, or param sent by function caller.
* **`headerPath`** `string[]` – Ordered headings from H1 (or highest level available) to current section (text only, no `#` marks)
* **`headerHierarchy`** `string` – Pre-joined breadcrumb using `" > "` separator
* **`headerSlugs`** `string[]` – Anchor IDs for linking
* **`sectionId`** `string` – Current section's ID (slug of last `headerPath` entry)
* **`heading`** string - Current section (last value from `headerPath`)

### Example

```json
{
  "fileTitle": "Individual Chunk File Output Format",
  "headerPath": [
    "Individual Chunk File Output Format",
    "Field Descriptions",
    "Token Information"
  ],
  "headerHierarchy": "Individual Chunk File Output Format > Field Descriptions > Token Information",
  "headerDepths": [1, 2, 3],
  "sectionId": "token-information"
}
```

### Implementation Notes

* **No markdown prefixes**: Store only text in `headerPath`, not `#` symbols
* **Array vs string**: Keep both forms - array for manipulation, string for display/search
* **Separator consistency**: Always use `" > "` for `headerHierarchy`
* **Alternative (future if required) format**: Can use objects in `headerPath` for richer metadata:
  ```json
  "headerPath": [
    { "text": "Individual Chunk File Output Format", "depth": 1 },
    { "text": "Field Descriptions", "depth": 2 }
  ]
  ```

## Title vs H1 Handling

* Keep **both** in metadata: `fileTitle` (document title) and `headerPath` (starting at first H1 in file)
* Build `headerHierarchy` from `headerPath` only (exclude `fileTitle`)
* When `fileTitle !== headerPath[0]`, prepend `fileTitle` when embedding text (don't modify `headerPath`)

## Embedded Text Rules

Use a conditional approach to balance context preservation with token efficiency.

### When to Prepend Header Context

1. **Build breadcrumb**: `headerHierarchy = headerPath.join(" > ")`
2. **Include fileTitle if different**: If `fileTitle !== headerPath[0]`, create `fullBreadcrumb = fileTitle + " > " + headerHierarchy`
3. **Prepend full breadcrumb when**:
   - Chunk starts a new section (contains heading node)
   - Chunk lacks context (code-only, table-only, list-only)
   - Chunk is short (< `minTokens` + overlap)
4. **Prepend only fileTitle when**:
   - Middle-of-section prose with clear flow
   - Only if `fileTitle !== headerPath[0]`
5. **Prepend nothing when**:
   - Chunk already starts with the exact heading
   - `fileTitle === headerPath[0]` and not a special case

### Formatting Rules

* **Deduplication**: Never add if chunk already starts with exact heading
* **Length limit**: Cap at 160 chars (truncate middle segments with `…`, keep first/last)
* **Format**: Plain text line + blank line:

  ```
  Document Title > API Reference > Authentication

  [chunk text...]
  ```

## Edge Cases

* **No H1 present**: `headerPath` starts at first heading found; still prepend `fileTitle`
* **Multiple H1s**: First H1 is document root; later H1s start new top-level sections
* **Frontmatter title**: Use as `fileTitle` only; don't modify `headerPath`. Used in `fullBreadcrumb`.
* If there are no headings at all: use fileTitle as section title, do not add to `headerPath` or `headerHierarchy`. Those are always derived only from headerPath, never from fileTitle.

## Rationale

This conditional approach:
* Controls token overhead (avoids repeating long trails unnecessarily)
* Provides disambiguation where needed (section starts, isolated code/tables)
* Maintains clean reading experience for continuous prose
* Can be toggled via `options.breadcrumbMode: "conditional" | "always" | "none"` (default: `"conditional"`)
