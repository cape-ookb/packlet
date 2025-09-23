### Normalization

**What it is**
Cleaning and standardizing the text of each chunk so embeddings are consistent and meaningful.

**Why it matters**

* Embedding models are sensitive to formatting noise. The same content with inconsistent whitespace or line endings can yield different vectors.
* Normalization produces clean, predictable output, making diffs and debugging easier.

**Where it belongs**

* Runs **after overlap** and **before metadata/guardrails** in the pipeline.
* Input: fully assembled chunk strings (with overlap already added).
* Output: cleaned chunk strings, safe for token counting and metadata.

**Normalization rules**

* Trim leading and trailing whitespace from the entire chunk content.
* Remove trailing spaces from each line.
* Standardize line endings to `\n`.
* Collapse multiple consecutive blank lines into a single blank line.
* Normalize multiple internal spaces to single spaces in regular text (outside code blocks).
* Dedent code blocks by removing the common minimum indentation, preserving relative indents.
* Preserve fenced code blocks intact (don't reflow, rewrap, or trim them).
* Preserve inline code formatting exactly as authored.

**Special handling**

* For code blocks:

  * Detect the minimum indentation level across non-fenced lines only.
  * Strip that common indentation while keeping relative structure.
  * Do not alter fenced block markers (\`\`\`) or their language tags.
  * Fenced code blocks (between \`\`\` markers) are preserved exactly as authored.

* For text normalization:

  * Space normalization only applies to regular text, not code blocks or empty lines.
  * Blank line collapsing preserves document structure while removing excessive whitespace.
  * All chunk metadata and properties are preserved during normalization.
