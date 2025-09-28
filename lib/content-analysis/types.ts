/**
 * types.ts
 *
 * Type definitions for content pattern detection system.
 * Defines content patterns, section structure, and analysis result types.
 */

import type { FlatNode } from '../flatten-ast';

export enum ContentPattern {
  ORGANIZATIONAL = 'organizational',  // Setup, Installation, Configuration
  REFERENCE = 'reference',           // API docs, function definitions
  PROCEDURAL = 'procedural',         // Step-by-step guides, tutorials
  CONCEPTUAL = 'conceptual',         // Explanatory content, theory
  FAQ = 'faq',                      // Question/answer format
  GLOSSARY = 'glossary',            // Definitions, terminology
  MIXED = 'mixed'                   // Multiple patterns or unclear
}

export type Section = {
  heading: FlatNode;
  content: FlatNode[];
  subsections: Section[];
  level: number;
  tokenCount: number;
  sectionId: string;
  isEmpty: boolean;
};

export type HeadingAnalysis = {
  isOrganizational: boolean;
  isReference: boolean;
  isProcedural: boolean;
  isQuestion: boolean;
  isDefinition: boolean;
  hasSequenceIndicator: boolean;
};

export type ContentAnalysis = {
  codeBlockRatio: number;
  listItemRatio: number;
  questionCount: number;
  definitionPatterns: number;
  imperativeVerbs: number;
  avgTokensPerParagraph: number;
  hasCallToAction: boolean;
};

export type StructureAnalysis = {
  hasParameterLists: boolean;
  hasReturnValues: boolean;
  hasOrderedSequence: boolean;
};

export type ContextAnalysis = {
  followsSequentialPattern: boolean;
  isPartOfSeries: boolean;
  hasRelatedSections: boolean;
};

export type MergingDecision = {
  shouldMerge: boolean;
  confidence: number;
  reason: string;
};