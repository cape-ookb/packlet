/**
 * flatten-ast.ts
 *
 * Walks AST and extracts nodes (headings, paragraphs, code, lists, tables).
 *
 * Returns array of `{ type, text, headingTrail, tokenCount, position }`.
 * Includes token counting during flattening for efficiency.
 *
 * See ../docs/flatten-ast.md for detailed algorithm documentation and examples.
 *
 * Responsibilities:
 * - Traverse the AST tree depth-first
 * - Extract text content from each node
 * - Count tokens for each node during extraction
 * - Maintain heading trail (e.g., ["Introduction", "Setup", "Installation"])
 * - Preserve node type and position information
 * - Return flat array while preserving hierarchical context
 *
 * The ../docs/flatten-ast.md file contains:
 * - Detailed traversal algorithm
 * - Edge case handling
 * - Example AST transformations
 * - Performance considerations
 */

import { countTokens } from './tokenizer';

export type FlatNode = {
  type: 'heading' | 'paragraph' | 'code' | 'list-item' | 'table' | 'blockquote';
  text: string;
  headingTrail: string[];
  tokenCount: number;
  depth?: number;
  lang?: string;
  position?: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
};

function extractText(node: any): string {
  if (node.value) return node.value;
  if (node.children) {
    return node.children.map(extractText).join('');
  }
  return '';
}

function processHeading(node: any, headingTrail: string[]): FlatNode {
  const headingText = extractText(node);
  updateHeadingTrail(headingText, node.depth, headingTrail);
  return {
    type: 'heading',
    text: headingText,
    headingTrail: [...headingTrail],
    tokenCount: countTokens(headingText),
    depth: node.depth,
    position: node.position
  };
}

function processParagraph(node: any, headingTrail: string[]): FlatNode {
  const text = extractText(node);
  return {
    type: 'paragraph',
    text: text,
    headingTrail: [...headingTrail],
    tokenCount: countTokens(text),
    position: node.position
  };
}

function processCode(node: any, headingTrail: string[]): FlatNode {
  const text = node.value || '';
  return {
    type: 'code',
    text: text,
    headingTrail: [...headingTrail],
    tokenCount: countTokens(text),
    lang: node.lang,
    position: node.position
  };
}

function processListItem(node: any, headingTrail: string[]): FlatNode {
  const text = extractText(node);
  return {
    type: 'list-item',
    text: text,
    headingTrail: [...headingTrail],
    tokenCount: countTokens(text),
    position: node.position
  };
}

function processTable(node: any, headingTrail: string[]): FlatNode {
  const text = extractText(node);
  return {
    type: 'table',
    text: text,
    headingTrail: [...headingTrail],
    tokenCount: countTokens(text),
    position: node.position
  };
}

function processBlockquote(node: any, headingTrail: string[]): FlatNode {
  const text = extractText(node);
  return {
    type: 'blockquote',
    text: text,
    headingTrail: [...headingTrail],
    tokenCount: countTokens(text),
    position: node.position
  };
}

function updateHeadingTrail(text: string, depth: number, headingTrail: string[]): void {
  headingTrail.splice(depth - 1);
  headingTrail[depth - 1] = text;
}

// Flatten AST into linear sequence of nodes
export function flattenAst(ast: any): FlatNode[] {
  const result: FlatNode[] = [];
  const headingTrail: string[] = [];

  function traverse(node: any): void {
    switch (node.type) {
      case 'heading':
        result.push(processHeading(node, headingTrail));
        break;
      case 'paragraph':
        result.push(processParagraph(node, headingTrail));
        break;
      case 'code':
        result.push(processCode(node, headingTrail));
        break;
      case 'listItem':
        result.push(processListItem(node, headingTrail));
        break;
      case 'table':
        result.push(processTable(node, headingTrail));
        break;
      case 'blockquote':
        result.push(processBlockquote(node, headingTrail));
        break;
      default:
        if (node.children) {
          node.children.forEach(traverse);
        }
        break;
    }
  }

  if (ast.children) {
    ast.children.forEach(traverse);
  }

  return result;
}