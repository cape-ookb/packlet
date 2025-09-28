// NOTE: Feel free to use _.lodash instead

// utils.ts

/**
 * Functional composition utility.
 * Composes functions from left to right.
 */
export const flow = (...fns: Function[]) => (x: any) => fns.reduce((v, f) => f(v), x);

/**
 * Create an ISO timestamp string.
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generate a unique chunk ID based on parent ID and chunk number.
 */
export function generateChunkId(parentId: string, chunkNumber: number): string {
  return `${parentId}::ch${chunkNumber}`;
}
