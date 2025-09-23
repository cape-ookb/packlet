# Flatten AST

After parsing Markdown into an AST (with `remark`/`mdast`), the tree structure has nested nodes — e.g. a `heading` node containing text nodes, a `list` node containing `listItem` nodes, and so on. For chunking, we don’t want to traverse this deep nesting over and over. Instead, we **flatten** the AST into a **linear sequence of semantic blocks**.

**Purpose:**

* Convert the hierarchical AST into a simple array of “flat nodes” that each represent a meaningful unit (heading, paragraph, code block, list, table, blockquote).
* Preserve essential metadata (heading trail, position, type, raw text).
* Ensure every downstream stage operates on a predictable, uniform structure (no tree-walking required later).

**Output Example:**

```json
[
  { "type": "heading", "depth": 1, "text": "Introduction", "headingTrail": ["Introduction"] },
  { "type": "paragraph", "text": "This is the opening paragraph...", "headingTrail": ["Introduction"] },
  { "type": "code", "lang": "js", "text": "function foo() {}", "headingTrail": ["Introduction"] },
  { "type": "heading", "depth": 2, "text": "Details", "headingTrail": ["Introduction", "Details"] },
  { "type": "paragraph", "text": "Here are more details...", "headingTrail": ["Introduction", "Details"] }
]
```

**Why it matters:**

* Keeps each step small and pure: parsing is one concern, flattening is another.
* Lets the packer treat everything uniformly (just a list of nodes with tokens).
* Heading trails give you hierarchical context without requiring tree logic downstream.
* Critical for recursive splitting: you can apply rules (paragraph → sentence → hard cut) cleanly on flat nodes.

Great question. The **granularity of a “flat node”** really determines how flexible the packer and recursive splitting logic can be. Here’s a breakdown by Markdown element:

---

### Headings (`#`, `##`, etc.)

* **Node = entire heading line** (just the text of the heading).
* Used as a marker with metadata (`depth`, `headingTrail`).
* Headings don’t usually stand alone as chunks — they attach to their following content.

### Paragraphs

* **Node = one full paragraph** (all inline text, links, emphasis).
* That’s the right balance: not too small (sentence = too fine too early), not too large (section = too big).
* Sentences come later in recursion only if the paragraph is oversized.

### Code blocks (fenced or indented)

* **Node = one fenced code block**, no splitting.
* Preserve language tag (`lang`) and formatting.
* Split only if the block itself exceeds max tokens (rare, but recursion rule applies).

### Lists

* **Node = individual list item**, not the whole list.
* Reason: a long list (e.g. 20 bullet points) could easily overshoot max tokens, but individual items are coherent units.
* Nested list items can be flattened into sibling nodes, with metadata like `listDepth`.

### Tables

* **Node = entire table**, unless it’s huge.
* Tables often need to be preserved intact for meaning.
* Oversized tables can be split row-by-row, but that’s a fallback rule.

### Blockquotes

* **Node = one blockquote block** (possibly multiple paragraphs inside).
* Flatten inner paragraphs as sub-nodes if needed.
* Metadata: `type = blockquote`.

### Horizontal rules, formatting-only (---, \*\*\*, etc.)

* **Node = skip or ignore.** Don’t create standalone nodes, they’re noise.

### Inline HTML / MDX

* **Node = single HTML/MDX block**, preserve intact.
* Treated like code blocks (splittable only if absurdly large).

---

### Rule of thumb

* **Default granularity = paragraph, list item, or code block.**
* Headings are kept as nodes for context, but they aren’t chunked alone.
* Only recurse down to **sentence** or **hard cut** if a node exceeds max tokens.

Here’s a clean **Flatten AST Granularity Rules** spec you can hand directly to your agent:

Tables are tricky because they carry meaning across rows and columns. Here’s a clear handling policy you can put in your spec:

---

### Table Handling Rules

1. **Default case (fits in budget):**

   * Treat the **entire table as one node**.
   * Preserve Markdown table syntax (pipes, alignment markers).
   * Keep any preceding heading or paragraph context attached.

2. **Oversized tables (exceeds max tokens):**

   * **Split by row** into multiple nodes.
   * Always keep the **header row duplicated** with each split so rows remain interpretable.
   * Attach metadata like `table: true`, `rowIndex`, `rowCount`.

3. **Very large cells:**

   * If an individual cell is itself oversized, fallback to sentence or hard split inside the cell content.

4. **No overlap inside tables:**

   * Don’t add sentence-level overlaps between table row nodes.
   * Continuity is preserved by repeating the header row.

5. **Validation guardrail:**

   * Reject or flag **orphaned table fragments** (e.g., a row without headers, malformed Markdown).
