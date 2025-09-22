/**
 * split-node.ts
 *
 * Implements recursive splitting logic (paragraph → sentence → hard cut).
 *
 * Input: oversized node. Output: array of smaller nodes.
 *
 * Splitting hierarchy:
 * 1. Try splitting on paragraph breaks (\n\n)
 * 2. Try splitting on sentence boundaries (. ! ?)
 * 3. Try splitting on line breaks (\n)
 * 4. Last resort: hard cut at word boundaries
 *
 * Each split preserves:
 * - Node type information
 * - Heading trail context
 * - Position data for source mapping
 *
 * Recursively splits until all nodes fit within maxTokens.
 */

// Split oversized nodes with finer rules
export function splitOversized(nodes: any[], options: any, countTokens: Function): any[] {
  // TODO: Split nodes that exceed max token limit
  return nodes;
}