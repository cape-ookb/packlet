/**
 * index.ts
 *
 * Main API for content pattern detection and merging decisions.
 * Orchestrates analysis components to provide high-level functionality.
 */

import type { Section, ContentPattern, MergingDecision } from './types';
import { analyzeHeading, analyzeContent, analyzeStructure, analyzeContext } from './analyzers';
import { calculatePatternScores, selectHighestScore } from './pattern-scoring';

export function detectContentPattern(section: Section): ContentPattern {
  const headingAnalysis = analyzeHeading(section.heading.text);
  const contentAnalysis = analyzeContent(section.content);
  const structureAnalysis = analyzeStructure(section);
  const contextAnalysis = analyzeContext(section);

  const scores = calculatePatternScores(headingAnalysis, contentAnalysis, structureAnalysis, contextAnalysis);
  return selectHighestScore(scores);
}

export function shouldMergeBasedOnPatterns(
  section1: Section,
  section2: Section
): MergingDecision {
  const pattern1 = detectContentPattern(section1);
  const pattern2 = detectContentPattern(section2);

  // High confidence merging scenarios
  if (pattern1 === ContentPattern.ORGANIZATIONAL && pattern2 === ContentPattern.ORGANIZATIONAL) {
    return {
      shouldMerge: true,
      confidence: 0.9,
      reason: 'Both sections are organizational (setup/configuration type)'
    };
  }

  if (pattern1 === ContentPattern.REFERENCE && pattern2 === ContentPattern.REFERENCE) {
    const topicalSimilarity = calculateTopicalSimilarity(section1, section2);
    return {
      shouldMerge: topicalSimilarity > 0.7,
      confidence: topicalSimilarity,
      reason: `Reference sections with ${Math.round(topicalSimilarity * 100)}% topical similarity`
    };
  }

  if (pattern1 === ContentPattern.FAQ && pattern2 === ContentPattern.FAQ) {
    return {
      shouldMerge: true,
      confidence: 0.8,
      reason: 'Both sections are FAQ format'
    };
  }

  if (pattern1 === ContentPattern.GLOSSARY && pattern2 === ContentPattern.GLOSSARY) {
    return {
      shouldMerge: true,
      confidence: 0.8,
      reason: 'Both sections are glossary/definition format'
    };
  }

  // Low confidence scenarios
  if (pattern1 === ContentPattern.CONCEPTUAL || pattern2 === ContentPattern.CONCEPTUAL) {
    return {
      shouldMerge: false,
      confidence: 0.9,
      reason: 'Conceptual content should generally remain separate'
    };
  }

  // Mixed or unclear patterns - be conservative
  if (pattern1 === ContentPattern.MIXED || pattern2 === ContentPattern.MIXED) {
    return {
      shouldMerge: false,
      confidence: 0.5,
      reason: 'Unclear content patterns - being conservative'
    };
  }

  return {
    shouldMerge: false,
    confidence: 0.6,
    reason: `Different content patterns: ${pattern1} vs ${pattern2}`
  };
}

function calculateTopicalSimilarity(section1: Section, section2: Section): number {
  // Simple keyword overlap analysis
  // In a real implementation, this could use more sophisticated NLP
  const text1 = (section1.heading.text + ' ' + section1.content.map(n => n.text).join(' ')).toLowerCase();
  const text2 = (section2.heading.text + ' ' + section2.content.map(n => n.text).join(' ')).toLowerCase();

  const words1 = new Set(text1.split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\W+/).filter(w => w.length > 3));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

// Re-export types and enums for convenience
export * from './types';