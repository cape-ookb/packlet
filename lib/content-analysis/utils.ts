/**
 * utils.ts
 *
 * Reusable utility functions for content analysis
 */

import type { AstNode } from '../types';

/**
 * Helper: Estimate text length of a node
 */
export function estimateTextLength(node: AstNode): number {
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
export function hasMainlyLinks(node: AstNode): boolean {
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