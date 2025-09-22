import { encodingForModel } from 'js-tiktoken';

// --- Token counting ---
function buildTokenCounter(model = 'gpt-4o-mini') {
  // Use fast heuristic by default - it's accurate enough for chunking
  // ~3.5-4 chars per token is a good estimate for English text
  return (text) => Math.max(1, Math.floor(text.length / 3.8));

  // Uncomment below for accurate tiktoken counting (slower):
  // try {
  //   const enc = encodingForModel(model);
  //   return (text) => enc.encode(text).length;
  // } catch (error) {
  //   return (text) => Math.max(1, Math.floor(text.length / 3.8));
  // }
}

// --- Sentence splitter (fast, dependency-lite) ---
const SENT_RE = /(?<=\S[.!?])\s+(?=[A-Z0-9"'(])/g;

function splitSentences(text) {
  // Keep code blocks intact
  const blocks = [];
  let lastIndex = 0;

  // Find code blocks
  const codeBlockRegex = /```[\s\S]*?```/g;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before.trim()) {
      blocks.push(...before.trim().split(SENT_RE).filter(s => s.trim()));
    }
    blocks.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  const tail = text.slice(lastIndex);
  if (tail.trim()) {
    blocks.push(...tail.trim().split(SENT_RE).filter(s => s.trim()));
  }

  return blocks.filter(b => b.trim());
}

// --- Hierarchical split rules ---
function splitByMarkdownHeadings(text) {
  const parts = text.trim().split(/(?=^#{1,6}\s)/m);
  return parts.filter(p => p.trim());
}

function splitByParagraph(text) {
  const parts = text.trim().split(/\n{2,}/);
  return parts.filter(p => p.trim());
}

function splitBySentence(text) {
  return splitSentences(text);
}

function splitByCodeSymbols(text) {
  // JavaScript/Python-biased heuristics
  const parts = text.trim().split(/(?=^\s*(def |class |function |export |const |let |var ))/m);
  return parts.filter(p => p.trim());
}

// --- Core adaptive chunker ---
export function adaptiveChunk(text, options = {}) {
  const {
    maxTokens = 400,
    minTokens = 200,
    overlapSentences = 1,
    tokenModel = 'gpt-4o-mini',
    structure = 'markdown' // 'markdown', 'plain', 'code'
  } = options;

  const countTokens = buildTokenCounter(tokenModel);

  // Choose splitters by corpus type
  let splitters;
  if (structure === 'markdown') {
    splitters = [splitByMarkdownHeadings, splitByParagraph, splitBySentence];
  } else if (structure === 'code') {
    splitters = [splitByCodeSymbols, splitByParagraph, splitBySentence];
  } else {
    splitters = [splitByParagraph, splitBySentence];
  }

  const tooBig = (s) => countTokens(s) > maxTokens;

  function splitWithRules(s, rules) {
    if (rules.length === 0) {
      // Last resort hard cut
      return hardCut(s, maxTokens, countTokens);
    }

    const parts = rules[0](s);
    if (parts.length === 1) {
      // If this segment is still too big, try finer rule
      if (tooBig(s)) {
        return splitWithRules(s, rules.slice(1));
      }
      return [s];
    }

    // For each part, if too big, split further; else keep
    const out = [];
    for (const p of parts) {
      if (tooBig(p)) {
        out.push(...splitWithRules(p, rules.slice(1)));
      } else {
        out.push(p);
      }
    }
    return out;
  }

  function hardCut(s, maxToks, tokFunc) {
    // Cut on whitespace near boundaries to reduce fragmentation
    const words = s.split(/\s+/);
    const chunks = [];
    let cur = [];
    let curTokens = 0;

    for (const word of words) {
      const wordTokens = tokFunc(word + ' ');
      if (curTokens + wordTokens > maxToks && cur.length > 0) {
        chunks.push(cur.join(' ').trim());
        cur = [word];
        curTokens = wordTokens;
      } else {
        cur.push(word);
        curTokens += wordTokens;
      }
    }

    if (cur.length > 0) {
      chunks.push(cur.join(' ').trim());
    }

    return chunks;
  }

  // 1) Pre-split with hierarchy
  const parts = splitWithRules(text, splitters);

  // 2) Greedy, look-ahead packer: fill up to maxTokens; if chunk < minTokens, pull next piece(s)
  const chunks = [];
  let buf = [];
  let bufTokens = 0;

  function flush() {
    if (buf.length === 0) return;
    const body = buf.join('\n\n').trim();

    // Quality check: reject low-quality chunks
    if (isLowQualityChunk(body)) {
      buf = [];
      bufTokens = 0;
      return;
    }

    const nTokens = countTokens(body);
    chunks.push({
      id: chunks.length,
      text: body,
      nTokens: nTokens,
      meta: { structure }
    });
    buf = [];
    bufTokens = 0;
  }

  function isLowQualityChunk(content) {
    const trimmed = content.trim();

    // Too short (unless it's a meaningful header)
    if (trimmed.length < 100 && !/^#+\s+\w/.test(trimmed)) {
      return true;
    }

    // Just standalone separators or formatting
    if (/^-+$/.test(trimmed) ||
        /^#+\s*$/.test(trimmed) ||
        /^\s*[`*_-]+\s*$/.test(trimmed) ||
        /^```\s*$/.test(trimmed)) {
      return true;
    }

    // Just code import/snippet without context
    if (/^```[\s\S]*```$/.test(trimmed) && trimmed.length < 200) {
      return true;
    }

    // Just script tags without explanation
    if (/^<script[\s\S]*<\/script>$/.test(trimmed) && trimmed.length < 200) {
      return true;
    }

    return false;
  }

  let i = 0;
  while (i < parts.length) {
    const piece = parts[i];
    const pieceTokens = countTokens(piece);

    if (pieceTokens > maxTokens) {
      // Should have been split earlier; but if it slipped through, hard cut now
      const subParts = hardCut(piece, maxTokens, countTokens);
      parts.splice(i, 1, ...subParts);
      continue;
    }

    if (bufTokens + pieceTokens <= maxTokens) {
      buf.push(piece);
      bufTokens += pieceTokens;
      i++;
    } else {
      // If current buffer is too small, try pulling one more smaller piece (look-ahead merge)
      if (bufTokens < minTokens) {
        // If even one more piece doesn't fit, we must flush
        if (i < parts.length && bufTokens + pieceTokens <= maxTokens) {
          buf.push(piece);
          bufTokens += pieceTokens;
          i++;
        } else {
          flush();
        }
      } else {
        flush();
      }
    }
  }

  flush();

  // 3) Add sentence-overlap for context (cheap and helpful)
  if (overlapSentences > 0 && chunks.length > 1) {
    for (let j = 1; j < chunks.length; j++) {
      const prevTail = splitSentences(chunks[j - 1].text).slice(-overlapSentences);
      chunks[j].text = (prevTail.join(' ') + ' ' + chunks[j].text).trim();
      chunks[j].nTokens = countTokens(chunks[j].text);
    }
  }

  return chunks;
}

// --- Helper for LangChain integration ---
export function adaptiveChunkDocuments(documents, options = {}) {
  const allChunks = [];

  for (const doc of documents) {
    const chunks = adaptiveChunk(doc.pageContent, options);

    // Convert to LangChain Document format
    for (const chunk of chunks) {
      allChunks.push({
        pageContent: chunk.text,
        metadata: {
          ...doc.metadata,
          chunkId: chunk.id,
          chunkTokens: chunk.nTokens,
          structure: chunk.meta.structure
        }
      });
    }
  }

  return allChunks;
}