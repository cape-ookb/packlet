# Code Examples

## TypeScript Function

```typescript
export function parseMarkdown(text: string): AstRoot {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const ast = processor.parse(text);
  return ast as AstRoot;
}
```

## Python Code

```python
def chunk_text(text, max_tokens=500):
    """Split text into chunks of max_tokens size."""
    words = text.split()
    chunks = []
    current_chunk = []

    for word in words:
        current_chunk.append(word)
        if len(' '.join(current_chunk)) > max_tokens:
            chunks.append(' '.join(current_chunk[:-1]))
            current_chunk = [word]

    if current_chunk:
        chunks.append(' '.join(current_chunk))

    return chunks
```

## Inline Code

Here's some `inline code` in a paragraph. And here's a variable `maxTokens` reference.

## Shell Commands

```bash
pnpm install
pnpm test
pnpm dev
```