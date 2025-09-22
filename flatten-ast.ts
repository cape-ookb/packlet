/**
 * flatten-ast.ts
 *
 * Walks AST and extracts nodes (headings, paragraphs, code, lists, tables).
 *
 * Returns array of `{ type, text, headingTrail, position }`.
 * Pure transformation, no token logic.
 *
 * See ./flatten-ast.md for detailed algorithm documentation and examples.
 *
 * Responsibilities:
 * - Traverse the AST tree depth-first
 * - Extract text content from each node
 * - Maintain heading trail (e.g., ["Introduction", "Setup", "Installation"])
 * - Preserve node type and position information
 * - Return flat array while preserving hierarchical context
 *
 * The flatten-ast.md file contains:
 * - Detailed traversal algorithm
 * - Edge case handling
 * - Example AST transformations
 * - Performance considerations
 */

// Flatten AST into linear sequence of nodes
export function flattenAst(ast: any): any[] {
  // TODO: Flatten AST into hierarchical node sequence
  // See flatten-ast.md for implementation details
  // ast parameter will be used to walk the tree
  return [];
}