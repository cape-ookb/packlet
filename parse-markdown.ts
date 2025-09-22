/**
 * parse-markdown.ts
 *
 * Parses Markdown into AST (using `remark` / `mdast`).
 *
 * Exports: `parseMarkdown(source: string): AstRoot`
 * Only responsibility: parse text, return AST tree.
 *
 * The AST provides structured access to:
 * - Headings with their levels
 * - Paragraphs and text content
 * - Code blocks (fenced and inline)
 * - Lists and list items
 * - Tables and other markdown elements
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import type { AstRoot } from './types';

export function parseMarkdown(text: string): AstRoot {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  const ast = processor.parse(text);
  return ast as AstRoot;
}