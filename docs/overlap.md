In practice, **you only need overlap in one direction** (forward).

Here’s why:

* When you chunk sequentially, each chunk ends with an overlap of \~10–20% (say 50 tokens).
* That means:

  * **Chunk A** ends with some trailing text.
  * **Chunk B** starts with that same trailing text + new text.
* Retrieval then has continuity—whichever chunk is pulled, the model sees enough of the surrounding context.

If you overlapped both sides (prepend + append), you’d just double the redundancy, inflating storage and sometimes confusing similarity scoring (since embeddings of adjacent chunks become nearly identical).

So the usual pattern looks like:

```
[----- Chunk 1 -----xxxxx]
                [xxxxx----- Chunk 2 -----xxxxx]
                                     [xxxxx----- Chunk 3 -----]
```

Where `xxxxx` is the overlap carried forward, not mirrored backward.

---

**When you might overlap both ways**:

* If your chunker emits **non-sequential chunks** (like from different section orders) and you want context padding on *both ends*.
* Or if you’re chunking **dialogues / transcripts** where continuity in both directions is critical.

But for Markdown docs (technical, guides, reference), a **single forward overlap** is usually the sweet spot.
