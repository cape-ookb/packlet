/**
 * slug-utils.ts
 *
 * Utilities for generating GitHub-compatible slugs from headings.
 * Maintains state to ensure unique slugs across a document.
 */

import GithubSlugger from 'github-slugger';
import { cleanMarkdownFromHeading } from './markdown-utils';

// Global slugger instance and cache to maintain state across all chunks
let globalSlugger = new GithubSlugger();
let slugCache = new Map<string, string>();

/**
 * Reset the global slugger and cache.
 * Should be called at the start of processing each document.
 */
export function resetSlugger(): void {
  globalSlugger = new GithubSlugger();
  slugCache.clear();
}

/**
 * Generate slugs for a header path.
 * Ensures consistency by caching slugs for repeated headings.
 */
export function generateHeaderSlugs(headerPath: string[]): string[] {
  const result: string[] = [];

  for (const heading of headerPath) {
    const cleanHeading = cleanMarkdownFromHeading(heading);

    // Check cache first - if we've seen this exact heading text before, use the same slug
    if (slugCache.has(cleanHeading)) {
      result.push(slugCache.get(cleanHeading)!);
    } else {
      // Generate new slug and cache it
      const slug = globalSlugger.slug(cleanHeading);
      slugCache.set(cleanHeading, slug);
      result.push(slug);
    }
  }

  return result;
}