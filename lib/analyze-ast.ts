/**
 * analyze-ast.ts
 *
 * Analyzes the parsed markdown AST to extract structure statistics.
 * Provides insights into document composition before chunking.
 */

import type { AstRoot, AstNode } from './types';
import type { StructureAnalysis } from './processing-context-types';

/**
 * Analyze AST to extract document structure statistics.
 * Traverses the AST once to count different node types.
 *
 * @param ast - The parsed markdown AST
 * @returns Structure analysis with counts of different element types
 */
export function analyzeAst(ast: AstRoot): StructureAnalysis {
  const analysis: StructureAnalysis = {
    headingCount: 0,
    paragraphCount: 0,
    codeBlockCount: 0,
    listCount: 0,
    tableCount: 0
  };

  // Recursive function to traverse AST
  function traverse(node: AstNode): void {
    // Count based on node type
    switch (node.type) {
      case 'heading':
        analysis.headingCount++;
        break;
      case 'paragraph':
        analysis.paragraphCount++;
        break;
      case 'code':
        analysis.codeBlockCount++;
        break;
      case 'list':
        analysis.listCount++;
        break;
      case 'table':
        analysis.tableCount++;
        break;
    }

    // Traverse children if they exist
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as AstNode);
      }
    }
  }

  // Start traversal from root
  if (ast.children && Array.isArray(ast.children)) {
    for (const child of ast.children) {
      traverse(child);
    }
  }

  return analysis;
}

/**
 * Extended structure analysis with more detailed metrics.
 * This can be used for more sophisticated analysis if needed.
 */
export interface ExtendedStructureAnalysis extends StructureAnalysis {
  headingLevels: Record<number, number>; // Count by heading level (1-6)
  avgParagraphLength?: number;
  maxNestingDepth: number;
  hasTableOfContents: boolean;
  hasFrontmatter: boolean;
  linkCount: number;
  imageCount: number;
  blockquoteCount: number;
  horizontalRuleCount: number;
}

/**
 * Perform extended analysis of the AST with more detailed metrics.
 * Provides deeper insights for advanced use cases.
 *
 * @param ast - The parsed markdown AST
 * @returns Extended structure analysis with detailed metrics
 */
export function analyzeAstExtended(ast: AstRoot): ExtendedStructureAnalysis {
  const analysis: ExtendedStructureAnalysis = {
    headingCount: 0,
    paragraphCount: 0,
    codeBlockCount: 0,
    listCount: 0,
    tableCount: 0,
    headingLevels: {},
    maxNestingDepth: 0,
    hasTableOfContents: false,
    hasFrontmatter: false,
    linkCount: 0,
    imageCount: 0,
    blockquoteCount: 0,
    horizontalRuleCount: 0
  };

  let totalParagraphLength = 0;

  // Recursive function to traverse AST with depth tracking
  function traverse(node: AstNode, depth: number = 0): void {
    // Track max nesting depth
    analysis.maxNestingDepth = Math.max(analysis.maxNestingDepth, depth);

    // Count based on node type
    switch (node.type) {
      case 'heading':
        analysis.headingCount++;
        if ('depth' in node && typeof node.depth === 'number') {
          analysis.headingLevels[node.depth] = (analysis.headingLevels[node.depth] || 0) + 1;
        }
        break;
      case 'paragraph':
        analysis.paragraphCount++;
        if ('children' in node) {
          // Estimate paragraph length by counting text nodes
          const textLength = estimateTextLength(node);
          totalParagraphLength += textLength;
        }
        break;
      case 'code':
        analysis.codeBlockCount++;
        break;
      case 'list':
        analysis.listCount++;
        break;
      case 'table':
        analysis.tableCount++;
        break;
      case 'link':
        analysis.linkCount++;
        break;
      case 'image':
        analysis.imageCount++;
        break;
      case 'blockquote':
        analysis.blockquoteCount++;
        break;
      case 'thematicBreak':
        analysis.horizontalRuleCount++;
        break;
      case 'yaml':
        analysis.hasFrontmatter = true;
        break;
    }

    // Check for table of contents pattern (list of links in early paragraphs)
    if (node.type === 'list' && depth <= 2 && analysis.headingCount <= 2) {
      // Simple heuristic: early list might be TOC
      if (hasMainlyLinks(node)) {
        analysis.hasTableOfContents = true;
      }
    }

    // Traverse children if they exist
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as AstNode, depth + 1);
      }
    }
  }

  // Start traversal from root
  if (ast.children && Array.isArray(ast.children)) {
    for (const child of ast.children) {
      traverse(child);
    }
  }

  // Calculate average paragraph length
  if (analysis.paragraphCount > 0) {
    analysis.avgParagraphLength = Math.round(totalParagraphLength / analysis.paragraphCount);
  }

  return analysis;
}

/**
 * Helper: Estimate text length of a node
 */
function estimateTextLength(node: AstNode): number {
  let length = 0;

  function countText(n: AstNode): void {
    if (n.type === 'text' && 'value' in n && typeof n.value === 'string') {
      length += n.value.length;
    }
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) {
        countText(child as AstNode);
      }
    }
  }

  countText(node);
  return length;
}

/**
 * Helper: Check if a list node contains mainly links
 */
function hasMainlyLinks(node: AstNode): boolean {
  let linkCount = 0;
  let totalItems = 0;

  function countLinks(n: AstNode): void {
    if (n.type === 'listItem') {
      totalItems++;
    }
    if (n.type === 'link') {
      linkCount++;
    }
    if ('children' in n && Array.isArray(n.children)) {
      for (const child of n.children) {
        countLinks(child as AstNode);
      }
    }
  }

  countLinks(node);

  // Consider it a TOC if >70% of items contain links
  return totalItems > 0 && (linkCount / totalItems) > 0.7;
}