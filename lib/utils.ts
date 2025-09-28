// NOTE: Feel free to use _.lodash instead

// utils.ts

/**
 * Functional composition utility.
 * Composes functions from left to right.
 * The first function can accept multiple arguments, subsequent functions receive one argument.
 */
export const flow = (...fns: Function[]) => (...args: any[]) => {
  const [firstFn, ...restFns] = fns;
  return restFns.reduce((v, f) => f(v), firstFn(...args));
};

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
