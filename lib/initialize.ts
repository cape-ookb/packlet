/**
 * initialize.ts
 *
 * Pipeline initialization - the entry point for all chunking operations.
 * Creates the initial ProcessingContext that flows through the entire pipeline.
 */

import type { ProcessingBase } from './processing-context-types';
import { initializeSource } from './source';
import { withDefaults } from './default-config';
import { startTimer } from './timer';

/**
 * Initialize processing context - the first step of the chunking pipeline.
 * Creates the minimal ProcessingBase with source data, options, and timer.
 * This is the entry point that handles options processing and setup.
 *
 * @param sourceDocument - The markdown content to process
 * @param fileTitle - The source file title/name
 * @param rawOptions - Raw chunking options (defaults will be applied)
 * @returns Minimal ProcessingBase ready for pipeline processing
 */
export function initializeProcessing(
  sourceDocument: string,
  fileTitle: string,
  rawOptions: import('./types').ChunkOptions
): ProcessingBase {
  const timer = startTimer();
  const options = withDefaults(rawOptions);
  const source = initializeSource(sourceDocument, fileTitle, options);

  return {
    source,
    options,
    timer,
    stage: 'initialized'
  };
}