# Title, Header Trail, Section

Including the **title (top-level heading)** in every chunk from a file is usually the right call. It should be from yaml front-matter, H1 header (if only one), or passed manually for a particular document.

Here’s why:

* **Context anchor** → Many retrieval queries make more sense if the model sees the document’s title along with the body text. Otherwise, chunks from different files may look similar.
* **Disambiguation** → Titles prevent collisions (e.g., multiple “Introduction” sections across files).
* **Retrieval quality** → Embeddings become more semantically distinct if the high-level topic is always visible.
* **Consistency** → Every chunk can stand alone during retrieval, even if it’s far from the file’s start.

### Practical guidance

* Store the title both in **metadata** (e.g., `fileTitle`) and inline in the chunk text.
* Inline style: prepend as the first line, e.g.

  ```
  # Document Title
  [rest of chunk...]
  ```
* Only repeat the **top-level title** (H1). Lower-level headings (`##`, `###`) should appear only in chunks where they apply.
* Deduplicate → if a chunk *already starts* with the H1, don’t add it again.

Prepend the **full heading trail** (`Title > Section > Subsection`) into each chunk — that can be more valuable than just the title alone, especially for larger docs.

Would you like me to propose a **“Heading Context Rule”** for your spec (covering when to include H1, heading trails, and how to handle duplication)?

Yes—include both. Store the **array form** for precise programmatic use and a **pre-joined trail** for quick display/search.

### Recommended title/header metadata fields

* `fileTitle: string` – H1 title of the document.
* `headerPath: string[]` – ordered list of headings from H1 → current section (your example).
* `headerHierarchy: string` – stable, precomputed breadcrumb string (use a fixed separator like `" > "`).
* `headerDepths: number[]` – optional, parallel to `headerPath` (e.g., `[1,2,3]`).
* `headerSlugs: string[]` – optional, anchor ids for linking (remark-slug or your own slugger).
* `sectionId: string` – optional, a deterministic ID for the *current* section (e.g., slug of last entry in `headerPath`).
* `nodeType: "paragraph" | "listItem" | "code" | "table" | ...`
* `tokenCount: number`
* `source: { filePath: string; startLine?: number; endLine?: number }`

### Why keep both array and string

* **Array (`headerPath`)**: easy to manipulate (drop last, compare prefixes, rerank by depth).
* **String (`headerHierarchy`)**: cheap to display, filter, or index as a single facet in search.

### Practical tips

* Use a **constant separator** for `headerHierarchy` (e.g., `" > "`) and never localize it—stability beats prettiness here.
* Keep the **H1 in both** `fileTitle` and as the first element of `headerPath` for redundancy and easier queries.
* When **prepending heading context** to chunk text, prefer the **full trail** (joined) and dedupe if the chunk already starts with the same heading.
* Generate **slugs deterministically** (lowercase, hyphenate, strip punctuation) to make links stable across builds.
* Cap breadcrumb length in UI, but **do not truncate** in metadata; storage is cheap, ambiguity is expensive.

### Tiny example

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
  "headerSlugs": ["individual-chunk-file-output-format", "field-descriptions", "token-information"],
  "sectionId": "token-information",
  "nodeType": "paragraph",
  "tokenCount": 274,
  "source": { "filePath": "docs/chunk-output.md", "startLine": 82, "endLine": 104 }
}
```

Don’t store the raw Markdown prefix (`#`, `##`, etc.) in `headerPath`.

Here’s why:

* **Semantics vs. presentation** → `headerPath` should be the *semantic text only*. The level is already represented separately in the AST as `depth` (1–6). Mixing `#` into the text blurs content vs. formatting.
* **Stability** → if later you render breadcrumbs, you don’t want to deal with stripping Markdown prefixes.
* **Internationalization / formatting** → some renderers don’t use `#` at all; level is better as metadata.

### Recommended approach

* `headerPath` → plain text headings: `["Individual Chunk File Output Format", "Field Descriptions", "Token Information"]`
* `headerDepths` → parallel numeric array: `[1,2,3]` (or store per entry as objects)

### Alternative compact form

You could also represent each step as an object if you prefer richer metadata:

```json
"headerPath": [
  { "text": "Individual Chunk File Output Format", "depth": 1 },
  { "text": "Field Descriptions", "depth": 2 },
  { "text": "Token Information", "depth": 3 }
]
```

That way, you don’t need a separate `headerDepths` array.

---

Short answer: **use a conditional approach** in terms of what goes into the actual chunk text to be embedded.

# Title vs H1

* Keep **both** in metadata: `fileTitle` (document title) and `headerPath` starting at the **first H1 actually in the file**.
* Build `headerHierarchy` from `headerPath` only (no `fileTitle`).
* When **`fileTitle !== headerPath[0]`**, do **not** rewrite `headerPath`; instead, when embedding text **prepend** `fileTitle` ahead of the hierarchy.

# Embedded text (what goes into the chunk body)

Prefer a conditional approach with clear rules to control token overhead while preserving context.

### Breadcrumb (headerHierarchy) Prepend Rules

1. **Compute** `headerHierarchy = headerPath.join(" > ")` (no `#` marks).
2. **If** `fileTitle` exists and `fileTitle !== headerPath[0]`, set `fullBreadcrumb = fileTitle + " > " + breadcrumb`; else `fullBreadcrumb = breadcrumb`.
3. **Prepend `fullBreadcrumb`** to the **chunk text** in these cases:

   * The chunk **contains or starts a new section** (i.e., includes a heading node for its section).
   * The chunk’s **nodeType(s) lack self-evident context** (e.g., table-only, code-only, list-only).
   * The chunk is **shorter than `minTokens` + overlap** (extra context helps retrieval).
4. **Otherwise** (middle-of-section prose with clear flow), **prepend only `fileTitle`** if present and distinct; if `fileTitle` equals H1, prepend nothing.
5. **Never duplicate**: if the chunk already begins with that exact heading line, don’t add the breadcrumb.
6. **Cap length**: if `fullBreadcrumb.length > 160 chars`, truncate middle segments with `…` but keep first (Title) and last (current section).
7. **Formatting**: breadcrumb is a plain first line, then a blank line. Example:

   ```
   Document Title > API Reference > Authentication

   <chunk text…>
   ```

### Edge Cases

* **No H1 present**: `headerPath` starts at the first encountered heading level; still include `fileTitle` (or file stem) before it.
* **Multiple H1s**: treat the **first H1** as document root for `headerPath`; later H1s begin new top-level sections.
* **Frontmatter title**: use as `fileTitle`; don’t inject it into `headerPath`.

### Why conditional

* Keeps **token cost predictable** (you’re not repeating long trails on every chunk).
* Ensures **disambiguation** where it matters most (section starts, code/table-only chunks).
* Avoids redundancy when the chunk already carries obvious context.

If need to make this toggleable in the future, add `options.breadcrumbMode: "conditional" | "always" | "none"` with `"conditional"` as the default.
