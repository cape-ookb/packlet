/**
 * analyzers.ts
 *
 * Content analysis functions for pattern detection.
 * Analyzes heading text, content structure, and document context.
 */

import type { FlatNode } from '../flatten-ast';
import type { Section, HeadingAnalysis, ContentAnalysis, StructureAnalysis, ContextAnalysis } from './types';
import { ORGANIZATIONAL_KEYWORDS, REFERENCE_KEYWORDS, PROCEDURAL_KEYWORDS, IMPERATIVE_VERBS, CALL_TO_ACTION_WORDS } from './keywords';

export function analyzeHeading(headingText: string): HeadingAnalysis {
  const text = headingText.toLowerCase();

  return {
    isOrganizational: ORGANIZATIONAL_KEYWORDS.some(keyword => text.includes(keyword)),
    isReference: REFERENCE_KEYWORDS.some(keyword => text.includes(keyword)),
    isProcedural: PROCEDURAL_KEYWORDS.some(keyword => text.includes(keyword)),
    isQuestion: text.includes('?') || text.startsWith('how ') || text.startsWith('what '),
    isDefinition: text.includes('what is') || text.endsWith('definition'),
    hasSequenceIndicator: /\b(step|part|phase)\s*\d+/.test(text)
  };
}

export function analyzeContent(content: FlatNode[]): ContentAnalysis {
  const totalNodes = content.length;
  if (totalNodes === 0) return getEmptyContentAnalysis();

  return {
    codeBlockRatio: content.filter(n => n.type === 'code').length / totalNodes,
    listItemRatio: content.filter(n => n.type === 'list-item').length / totalNodes,
    questionCount: countQuestions(content),
    definitionPatterns: countDefinitionPatterns(content),
    imperativeVerbs: countImperativeVerbs(content),
    avgTokensPerParagraph: calculateAvgTokensPerParagraph(content),
    hasCallToAction: hasCallToActionLanguage(content)
  };
}

export function analyzeStructure(section: Section): StructureAnalysis {
  const contentText = section.content.map(node => node.text).join(' ').toLowerCase();

  return {
    hasParameterLists: /parameters?:|arguments?:|props?:/.test(contentText),
    hasReturnValues: /returns?:|response:|output:/.test(contentText),
    hasOrderedSequence: section.content.some(node =>
      node.type === 'list-item' && /^\d+\./.test(node.text.trim())
    )
  };
}

export function analyzeContext(_section: Section): ContextAnalysis {
  // This requires access to document-level context
  // For now, return basic analysis - can be enhanced with document context
  return {
    followsSequentialPattern: false,
    isPartOfSeries: false,
    hasRelatedSections: false
  };
}

function getEmptyContentAnalysis(): ContentAnalysis {
  return {
    codeBlockRatio: 0,
    listItemRatio: 0,
    questionCount: 0,
    definitionPatterns: 0,
    imperativeVerbs: 0,
    avgTokensPerParagraph: 0,
    hasCallToAction: false
  };
}

function countQuestions(content: FlatNode[]): number {
  return content.reduce((count, node) => {
    const sentences = node.text.split(/[.!?]+/);
    return count + sentences.filter((s: string) => s.trim().includes('?')).length;
  }, 0);
}

function countDefinitionPatterns(content: FlatNode[]): number {
  return content.reduce((count, node) => {
    const text = node.text.toLowerCase();
    const patterns = [
      /\bis\s+(a|an|the)\s+/g,
      /\bmeans\s+/g,
      /\brefers\s+to\s+/g,
      /\bdefined\s+as\s+/g
    ];
    return count + patterns.reduce((patternCount, pattern) => {
      const matches = text.match(pattern);
      return patternCount + (matches ? matches.length : 0);
    }, 0);
  }, 0);
}

function countImperativeVerbs(content: FlatNode[]): number {
  return content.reduce((count, node) => {
    const text = node.text.toLowerCase();
    return count + IMPERATIVE_VERBS.filter(verb =>
      new RegExp(`\\b${verb}\\b`).test(text)
    ).length;
  }, 0);
}

function calculateAvgTokensPerParagraph(content: FlatNode[]): number {
  const paragraphs = content.filter(node => node.type === 'paragraph');
  if (paragraphs.length === 0) return 0;

  const totalTokens = paragraphs.reduce((sum, node) => sum + node.tokenCount, 0);
  return totalTokens / paragraphs.length;
}

function hasCallToActionLanguage(content: FlatNode[]): boolean {
  const contentText = content.map(node => node.text).join(' ').toLowerCase();

  return CALL_TO_ACTION_WORDS.some(word => contentText.includes(word));
}