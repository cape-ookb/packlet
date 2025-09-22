I think we should move away from the default LangChain `RecursiveCharacterTextSplitter` since it tends to produce a lot of tiny fragments. I found a Python implementation that illustrates the direction I’d like us to take—I’ll include the code for reference, but the idea is more important than the language. Since you’re working in JavaScript, you can adapt the concepts using libraries like:

* **Token counting** → `tiktoken` (there’s a JS port: [`js-tiktoken`](https://github.com/dqbd/tiktoken))
* **Sentence splitting** → regex-based or something like [`sbd`](https://www.npmjs.com/package/sbd)
* **Markdown parsing** → [`remark`](https://github.com/remarkjs/remark) or similar

### Core approach

* Use **hierarchical splitting**: headings → paragraphs → sentences. Only descend when needed.
* Make chunks **token-aware**, not just character-based.
* Implement a **look-ahead merge**: if a chunk is too small, pull the next piece in before flushing.
* Add **soft overlap** (e.g., last 1–3 sentences from the previous chunk) to maintain continuity.
* Preserve **structure metadata** (heading trail, file path, etc.) for retrieval.

### Why this works

* **Hierarchy prevents tiny shards.** Large coherent blocks stay intact; only oversized sections are split further.
* **Look-ahead merge.** Avoids trailing micro-chunks by checking if the next piece can be safely added.
* **Token budgets, not characters.** Keeps chunks aligned with model context windows and cost.
* **Overlap.** Ensures continuity without bloating the index.
* **Structure flag.** Can adapt rules for Markdown vs. code vs. plain text.

### Tips for good retrieval

* **Dual indexing.** Store both section-level and packed chunks, retrieve k from each, then re-rank.
* **Rich metadata.** Keep headings, symbol names, or page numbers alongside text.
* **Normalization.** Dedent code blocks, collapse whitespace, preserve fenced blocks.
* **Quality guardrails.** Drop very short chunks unless they’re titles; otherwise attach them to their first child.

See the Python reference ./chunker.py implementation so you can see the details, but keep in mind we just need the logic ported into JS.
