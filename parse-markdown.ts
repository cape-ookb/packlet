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

// Parse Markdown into an AST structure
export function parseMarkdown(text: string): any {
  // TODO: Parse markdown into AST nodes using remark/mdast
  return {};
}