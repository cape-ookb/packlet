/**
 * pattern-scoring.ts
 *
 * Pattern scoring algorithms for content classification.
 * Each function evaluates how well content fits a specific pattern.
 */

import type { HeadingAnalysis, ContentAnalysis, StructureAnalysis, ContextAnalysis, ContentPattern } from './types';

export function scoreOrganizational(
  heading: HeadingAnalysis,
  content: ContentAnalysis,
  context: ContextAnalysis
): number {
  let score = 0;

  if (heading.isOrganizational) score += 0.4;
  if (heading.hasSequenceIndicator) score += 0.3;
  if (content.hasCallToAction) score += 0.2;
  if (content.listItemRatio > 0.3) score += 0.1; // Setup steps often use lists
  if (context.followsSequentialPattern) score += 0.2;

  return Math.min(score, 1.0);
}

export function scoreReference(
  heading: HeadingAnalysis,
  content: ContentAnalysis,
  structure: StructureAnalysis
): number {
  let score = 0;

  if (heading.isReference) score += 0.4;
  if (content.codeBlockRatio > 0.2) score += 0.3; // API docs have code examples
  if (structure.hasParameterLists) score += 0.2;
  if (structure.hasReturnValues) score += 0.1;
  if (content.avgTokensPerParagraph < 100) score += 0.1; // Concise descriptions

  return Math.min(score, 1.0);
}

export function scoreProcedural(
  heading: HeadingAnalysis,
  content: ContentAnalysis,
  structure: StructureAnalysis
): number {
  let score = 0;

  if (heading.isProcedural) score += 0.4;
  if (content.imperativeVerbs > 2) score += 0.3; // "Click", "Run", "Install"
  if (content.listItemRatio > 0.4) score += 0.2; // Step-by-step lists
  if (structure.hasOrderedSequence) score += 0.1;

  return Math.min(score, 1.0);
}

export function scoreConceptual(
  content: ContentAnalysis,
  _structure: StructureAnalysis
): number {
  let score = 0;

  // Conceptual content tends to have longer paragraphs and fewer action items
  if (content.avgTokensPerParagraph > 150) score += 0.3;
  if (content.imperativeVerbs === 0) score += 0.2;
  if (content.codeBlockRatio < 0.1) score += 0.2;
  if (!content.hasCallToAction) score += 0.2;
  if (content.listItemRatio < 0.2) score += 0.1;

  return Math.min(score, 1.0);
}

export function scoreFAQ(heading: HeadingAnalysis, content: ContentAnalysis): number {
  let score = 0;

  if (heading.isQuestion) score += 0.5;
  if (content.questionCount > 0) score += 0.3;
  if (content.definitionPatterns > 0) score += 0.2;

  return Math.min(score, 1.0);
}

export function scoreGlossary(heading: HeadingAnalysis, content: ContentAnalysis): number {
  let score = 0;

  if (heading.isDefinition) score += 0.4;
  if (content.definitionPatterns > 0) score += 0.4;
  if (content.avgTokensPerParagraph < 80) score += 0.2; // Concise definitions

  return Math.min(score, 1.0);
}

export function calculatePatternScores(
  headingAnalysis: HeadingAnalysis,
  contentAnalysis: ContentAnalysis,
  structureAnalysis: StructureAnalysis,
  contextAnalysis: ContextAnalysis
): Record<ContentPattern, number> {
  return {
    [ContentPattern.ORGANIZATIONAL]: scoreOrganizational(headingAnalysis, contentAnalysis, contextAnalysis),
    [ContentPattern.REFERENCE]: scoreReference(headingAnalysis, contentAnalysis, structureAnalysis),
    [ContentPattern.PROCEDURAL]: scoreProcedural(headingAnalysis, contentAnalysis, structureAnalysis),
    [ContentPattern.CONCEPTUAL]: scoreConceptual(contentAnalysis, structureAnalysis),
    [ContentPattern.FAQ]: scoreFAQ(headingAnalysis, contentAnalysis),
    [ContentPattern.GLOSSARY]: scoreGlossary(headingAnalysis, contentAnalysis),
    [ContentPattern.MIXED]: 0.1 // Base score for fallback
  };
}

export function selectHighestScore(scores: Record<ContentPattern, number>): ContentPattern {
  let maxScore = 0;
  let bestPattern = ContentPattern.MIXED;

  for (const [pattern, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestPattern = pattern as ContentPattern;
    }
  }

  return bestPattern;
}