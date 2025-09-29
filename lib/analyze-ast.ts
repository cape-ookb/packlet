/**
 * analyze-ast.ts
 *
 * Analyzes the parsed markdown AST to extract structure statistics.
 * Provides insights into document composition before chunking.
 */

import type { AstRoot, AstNode } from './types';
import type { StructureAnalysis } from './processing-context-types';
import { estimateTextLength, hasMainlyLinks } from './content-analysis/utils';

/**
 * Analyze AST to extract comprehensive document structure statistics.
 * Traverses the AST once to count different node types and gather detailed metrics.
 *
 * @param ast - The parsed markdown AST
 * @returns Complete structure analysis with all available metrics
 */
export function analyzeAst(ast: AstRoot): StructureAnalysis {
  const analysis: StructureAnalysis = {
    // Basic element counts
    headingCount: 0,
    paragraphCount: 0,
    codeBlockCount: 0,
    listCount: 0,
    tableCount: 0,

    // Detailed heading analysis
    headingLevels: {},

    // Top-level node distribution
    nodeTypeDistribution: {},

    // Document characteristics
    maxNestingDepth: 0,
    avgParagraphLength: undefined,

    // Content type detection
    hasTableOfContents: false,
    hasFrontmatter: false,

    // Link and media counts
    linkCount: 0,
    imageCount: 0,

    // Additional markdown elements
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
        // Estimate paragraph length by counting text nodes
        const textLength = estimateTextLength(node);
        totalParagraphLength += textLength;
        break;
      case 'code':
        analysis.codeBlockCount++;
        break;
      case 'list':
        analysis.listCount++;
        // Check for table of contents pattern (list of links in early paragraphs)
        if (depth <= 2 && analysis.headingCount <= 2) {
          // Simple heuristic: early list might be TOC
          if (hasMainlyLinks(node)) {
            analysis.hasTableOfContents = true;
          }
        }
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

    // Traverse children if they exist
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child as AstNode, depth + 1);
      }
    }
  }

  // Start traversal from root and collect top-level node types
  if (ast.children && Array.isArray(ast.children)) {
    for (const child of ast.children) {
      // Track top-level node distribution
      analysis.nodeTypeDistribution[child.type] = (analysis.nodeTypeDistribution[child.type] || 0) + 1;

      // Then traverse the node
      traverse(child);
    }
  }

  // Calculate average paragraph length
  if (analysis.paragraphCount > 0) {
    analysis.avgParagraphLength = Math.round(totalParagraphLength / analysis.paragraphCount);
  }

  return analysis;
}


