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
  headingDepths: number[];
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

type ProcessingContext = {
  headingTrail: string[];
  headingDepths: number[];
  node: any;
};

function createFlatNode(
  type: FlatNode['type'],
  text: string,
  context: ProcessingContext,
  additionalFields: Partial<FlatNode> = {}
): FlatNode {
  return {
    type,
    text,
    headingTrail: [...context.headingTrail],
    headingDepths: [...context.headingDepths],
    tokenCount: countTokens(text),
    position: context.node.position,
    ...additionalFields
  };
}

function processHeading(context: ProcessingContext): FlatNode {
  const headingText = extractText(context.node);
  updateHeadingTrail(headingText, context.node.depth, context.headingTrail, context.headingDepths);
  return createFlatNode('heading', headingText, context, {
    depth: context.node.depth
  });
}

function processParagraph(context: ProcessingContext): FlatNode {
  return createFlatNode('paragraph', extractText(context.node), context);
}

function processCode(context: ProcessingContext): FlatNode {
  return createFlatNode('code', context.node.value || '', context, {
    lang: context.node.lang
  });
}

function processListItem(context: ProcessingContext): FlatNode {
  return createFlatNode('list-item', extractText(context.node), context);
}

function processTable(context: ProcessingContext): FlatNode {
  return createFlatNode('table', extractText(context.node), context);
}

function processBlockquote(context: ProcessingContext): FlatNode {
  return createFlatNode('blockquote', extractText(context.node), context);
}

function updateHeadingTrail(text: string, depth: number, headingTrail: string[], headingDepths: number[]): void {
  // Find position to insert/update based on depth
  let insertPosition = 0;

  // Find the position where this depth should go
  for (let i = 0; i < headingDepths.length; i++) {
    if (headingDepths[i] >= depth) {
      insertPosition = i;
      break;
    }
    insertPosition = i + 1;
  }

  // Remove all headings at this depth and deeper
  headingTrail.splice(insertPosition);
  headingDepths.splice(insertPosition);

  // Add the new heading
  headingTrail.push(text);
  headingDepths.push(depth);
}

// Flatten AST into linear sequence of nodes
export function flattenAst(ast: any): FlatNode[] {
  const result: FlatNode[] = [];
  const headingTrail: string[] = [];
  const headingDepths: number[] = [];

  function traverse(node: any): void {
    const context: ProcessingContext = { headingTrail, headingDepths, node };

    switch (node.type) {
      case 'heading':
        result.push(processHeading(context));
        break;
      case 'paragraph':
        result.push(processParagraph(context));
        break;
      case 'code':
        result.push(processCode(context));
        break;
      case 'listItem':
        result.push(processListItem(context));
        break;
      case 'table':
        result.push(processTable(context));
        break;
      case 'blockquote':
        result.push(processBlockquote(context));
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