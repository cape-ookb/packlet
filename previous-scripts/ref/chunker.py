import re
from typing import List, Dict, Callable, Tuple, Optional

# --- Token counting (tiktoken if available; otherwise heuristic) ---
def _build_token_counter(model: str = "gpt-4o-mini") -> Callable[[str], int]:
    try:
        import tiktoken
        enc = tiktoken.encoding_for_model(model)
        return lambda s: len(enc.encode(s))
    except Exception:
        # ~4 chars per token heuristic
        return lambda s: max(1, len(s) // 4)

# --- Sentence splitter (fast, dependency-lite) ---
_SENT_RE = re.compile(r"(?<=\S[.!?])\s+(?=[A-Z0-9\"'“(])")
def split_sentences(text: str) -> List[str]:
    # Keep code blocks intact
    blocks = []
    i = 0
    for m in re.finditer(r"(```[\s\S]*?```)", text):
        before = text[i:m.start()]
        if before: blocks.extend(_SENT_RE.split(before.strip()))
        blocks.append(m.group(1))
        i = m.end()
    tail = text[i:]
    if tail: blocks.extend(_SENT_RE.split(tail.strip()))
    # Trim empties
    return [b for b in (s.strip() for s in blocks) if b]

# --- Hierarchical split rules (tune for your corpus) ---
# Each rule returns a list of pieces; later rules are "finer"
def split_by_markdown_headings(text: str) -> List[str]:
    parts = re.split(r"(?m)(?=^#{1,6}\s)", text.strip())
    return [p for p in parts if p.strip()]

def split_by_paragraph(text: str) -> List[str]:
    parts = re.split(r"\n{2,}", text.strip())
    return [p for p in parts if p.strip()]

def split_by_sentence(text: str) -> List[str]:
    return split_sentences(text)

# Optional: code-aware splitter
def split_by_code_symbols(text: str) -> List[str]:
    # Python/JS-biased heuristics; extend as needed
    parts = re.split(r"(?m)(?=^\s*(def |class |function |export |const |let |var ))", text.strip())
    return [p for p in parts if p.strip()]

# --- Core adaptive packer ---
def adaptive_chunk(
    text: str,
    max_tokens: int = 800,
    min_tokens: int = 400,
    overlap_sentences: int = 1,
    token_model: str = "gpt-4o-mini",
    structure: str = "markdown",  # "markdown", "plain", "code"
) -> List[Dict]:
    """
    Returns a list of chunks: {id, text, n_tokens, meta}
    - Tries to keep chunks between min_tokens and max_tokens (token-aware)
    - Recursively uses coarser→finer splitters and only hard-cuts as last resort
    """
    count_tokens = _build_token_counter(token_model)

    # Choose splitters by corpus type
    if structure == "markdown":
        splitters = [split_by_markdown_headings, split_by_paragraph, split_by_sentence]
    elif structure == "code":
        splitters = [split_by_code_symbols, split_by_paragraph, split_by_sentence]
    else:
        splitters = [split_by_paragraph, split_by_sentence]

    def _too_big(s: str) -> bool: return count_tokens(s) > max_tokens

    def _split_with_rules(s: str, rules: List[Callable[[str], List[str]]]) -> List[str]:
        if not rules:
            # Last resort hard cut
            return _hard_cut(s, max_tokens, count_tokens)
        parts = rules[0](s)
        if len(parts) == 1:
            # If this segment is still too big, try finer rule
            if _too_big(s):
                return _split_with_rules(s, rules[1:])
            return [s]
        # For each part, if too big, split further; else keep
        out = []
        for p in parts:
            if _too_big(p):
                out.extend(_split_with_rules(p, rules[1:]))
            else:
                out.append(p)
        return out

    def _hard_cut(s: str, max_toks: int, tok: Callable[[str], int]) -> List[str]:
        # Cut on whitespace near boundaries to reduce fragmentation
        words = s.split()
        chunks, cur = [], []
        cur_tokens = 0
        for w in words:
            wtok = tok(w + " ")
            if cur_tokens + wtok > max_toks and cur:
                chunks.append(" ".join(cur).strip())
                cur, cur_tokens = [w], wtok
            else:
                cur.append(w); cur_tokens += wtok
        if cur:
            chunks.append(" ".join(cur).strip())
        return chunks

    # 1) Pre-split with hierarchy
    parts = _split_with_rules(text, splitters)

    # 2) Greedy, look-ahead packer: fill up to max_tokens; if chunk < min_tokens, pull next piece(s)
    chunks: List[Dict] = []
    buf: List[str] = []
    buf_tokens = 0

    def flush():
        nonlocal buf, buf_tokens, chunks
        if not buf: return
        body = "\n\n".join(buf).strip()
        n = count_tokens(body)
        chunks.append({"id": len(chunks), "text": body, "n_tokens": n})
        buf, buf_tokens = [], 0

    i = 0
    while i < len(parts):
        piece = parts[i]
        ptok = count_tokens(piece)
        if ptok > max_tokens:
            # Should have been split earlier; but if it slipped through, hard cut now
            for sub in _hard_cut(piece, max_tokens, count_tokens):
                parts.insert(i + 1, sub)
            i += 1
            continue

        if buf_tokens + ptok <= max_tokens:
            buf.append(piece)
            buf_tokens += ptok
            i += 1
        else:
            # If current buffer is too small, try pulling one more smaller piece (look-ahead merge)
            if buf_tokens < min_tokens:
                # If even one more piece doesn't fit, we must flush
                if i < len(parts) and buf_tokens + ptok <= max_tokens:
                    buf.append(piece)
                    buf_tokens += ptok
                    i += 1
                else:
                    flush()
            else:
                flush()

    flush()

    # 3) Add sentence-overlap for context (cheap and helpful)
    if overlap_sentences > 0 and len(chunks) > 1:
        for j in range(1, len(chunks)):
            prev_tail = split_sentences(chunks[j - 1]["text"])[-overlap_sentences:]
            chunks[j]["text"] = (" ".join(prev_tail) + " " + chunks[j]["text"]).strip()
            chunks[j]["n_tokens"] = count_tokens(chunks[j]["text"])

    # 4) Simple metadata hooks (you can enrich these upstream)
    for c in chunks:
        c["meta"] = {"structure": structure}

    return chunks

# --- Example ---
if __name__ == "__main__":
    sample = """# Title

Intro paragraph with some context.

## Section A
Paragraph one. Paragraph two. Another sentence to make this longer.

## Section B
A very long paragraph that might be too big for a single chunk depending on your token limits. It goes on and on, with multiple sentences. Code block follows:

