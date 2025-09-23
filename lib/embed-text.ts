/**
 * embed-text.ts
 *
 * Generates embedText from originalText with conditional breadcrumb prepending.
 *
 * Reads metadata but never modifies it - context prepending only affects embedText output.
 * Implements conditional logic based on breadcrumbMode setting.
 *
 * Responsibilities:
 * - Detect when chunks need context (new sections, isolated content, short chunks)
 * - Build appropriate breadcrumb strings from metadata
 * - Generate final embedText without modifying metadata fields
 * - Handle breadcrumbMode: "conditional" | "always" | "none"
 */

import type { Chunk } from './types.js';

/**
 * Truncate breadcrumb to max 160 characters with middle ellipsis
 */
function truncateBreadcrumb(breadcrumb: string, maxLength: number = 160): string {
  if (breadcrumb.length <= maxLength) return breadcrumb;

  const ellipsis = '…';
  const sideLength = Math.floor((maxLength - ellipsis.length) / 2);

  return breadcrumb.slice(0, sideLength) + ellipsis + breadcrumb.slice(-sideLength);
}

/**
 * Build full breadcrumb context string
 */
function buildFullBreadcrumb(fileTitle: string, headerBreadcrumb: string, headerPath: string[]): string {
  // If fileTitle is the same as first header, don't duplicate
  if (fileTitle === headerPath[0]) {
    return headerBreadcrumb;
  }

  // Combine fileTitle with headerBreadcrumb
  return headerBreadcrumb ? `${fileTitle} > ${headerBreadcrumb}` : fileTitle;
}

/**
 * Detect if chunk needs context based on content analysis
 */
function needsContext(chunk: Chunk, minTokens: number): {
  needsFullContext: boolean;
  needsFileTitle: boolean;
} {
  const originalText = chunk.originalText || chunk.content || '';
  const tokens = chunk.tokenStats?.tokens || chunk.tokens || 0;
  const nodeTypes = chunk.metadata?.nodeTypes || [];

  // Check if chunk starts with a heading (new section)
  const startsWithHeading = originalText.trim().match(/^#+\s/);

  // Check if chunk is context-less (only code, tables, lists)
  const isContextless = nodeTypes.length > 0 &&
    nodeTypes.every(type => ['code', 'table', 'list-item'].includes(type));

  // Check if chunk is short
  const isShort = tokens < minTokens;

  // Determine context needs
  const needsFullContext = Boolean(startsWithHeading || isContextless || isShort);

  // For middle-of-section prose, only need fileTitle if different from first header
  const needsFileTitle = !needsFullContext &&
    chunk.metadata?.fileTitle !== chunk.metadata?.headerPath?.[0];

  return { needsFullContext, needsFileTitle };
}

/**
 * Check if chunk already starts with the exact heading text
 */
function startsWithExactHeading(originalText: string, sectionTitle: string): boolean {
  if (!sectionTitle) return false;

  const trimmed = originalText.trim();
  const headingPattern = new RegExp(`^#+\\s*${sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');

  return headingPattern.test(trimmed);
}

/**
 * Generate embedText from chunk based on breadcrumbMode
 */
export function generateEmbedText(
  chunk: Chunk,
  breadcrumbMode: 'conditional' | 'always' | 'none' = 'conditional',
  minTokens: number = 200
): string {
  const originalText = chunk.originalText || chunk.content || '';

  // Mode: none - never prepend
  if (breadcrumbMode === 'none') {
    return originalText;
  }

  const fileTitle = chunk.metadata?.fileTitle || '';
  const headerBreadcrumb = chunk.metadata?.headerBreadcrumb || '';
  const headerPath = chunk.metadata?.headerPath || [];
  const sectionTitle = chunk.metadata?.sectionTitle || '';

  // Don't add if chunk already starts with exact heading
  if (startsWithExactHeading(originalText, sectionTitle)) {
    return originalText;
  }

  // Mode: always - always prepend full breadcrumb
  if (breadcrumbMode === 'always') {
    const fullBreadcrumb = buildFullBreadcrumb(fileTitle, headerBreadcrumb, headerPath);
    if (fullBreadcrumb) {
      const truncated = truncateBreadcrumb(fullBreadcrumb);
      return `${truncated}\n\n${originalText}`;
    }
    return originalText;
  }

  // Mode: conditional - smart context detection
  const { needsFullContext, needsFileTitle } = needsContext(chunk, minTokens);

  if (needsFullContext) {
    const fullBreadcrumb = buildFullBreadcrumb(fileTitle, headerBreadcrumb, headerPath);
    if (fullBreadcrumb) {
      const truncated = truncateBreadcrumb(fullBreadcrumb);
      return `${truncated}\n\n${originalText}`;
    }
  } else if (needsFileTitle && fileTitle) {
    return `${fileTitle}\n\n${originalText}`;
  }

  return originalText;
}

/**
 * Process chunks to add embedText field based on breadcrumbMode
 */
export function addEmbedText(
  chunks: Chunk[],
  breadcrumbMode: 'conditional' | 'always' | 'none' = 'conditional',
  minTokens: number = 200
): Chunk[] {
  return chunks.map(chunk => ({
    ...chunk,
    embedText: generateEmbedText(chunk, breadcrumbMode, minTokens)
  }));
}