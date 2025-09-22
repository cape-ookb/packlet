/**
 * metadata.ts
 *
 * Attaches heading trail, node type, token count, file path (if available).
 *
 * Adds unique chunk IDs.
 *
 * Metadata fields:
 * - id: Unique identifier (e.g., "doc-source-ch0")
 * - headingTrail: Array of parent headings (e.g., ["API", "Methods", "getData"])
 * - nodeTypes: Types of nodes in chunk (e.g., ["heading", "paragraph", "code"])
 * - tokenCount: Exact token count for this chunk
 * - source: Original file path/name if available
 * - index: Position in document (0-based)
 * - prevId/nextId: Links to adjacent chunks
 *
 * Used for:
 * - Retrieval context (heading trail helps understand where content belongs)
 * - Filtering (e.g., search only code chunks)
 * - Navigation (prev/next links)
 * - Debugging (source tracking)
 */

// Attach metadata such as heading trail and node type
export function attachMetadata(chunks: any[], options: any, countTokens: Function): any[] {
  // TODO: Add metadata like header hierarchy, node types, token counts
  return chunks;
}