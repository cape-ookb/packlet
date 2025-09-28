/**
 * content-pattern-detection.ts
 *
 * Analyzes document sections to detect content patterns for intelligent merging decisions.
 * Supports contextual H1 boundary rules based on content analysis rather than rigid structural rules.
 *
 * Key responsibilities:
 * - Detect content patterns (organizational, reference, procedural, conceptual, FAQ, glossary)
 * - Analyze heading text, content structure, and sequential context
 * - Provide confidence scores for merging decisions
 * - Enable smart H1 boundary merging based on semantic analysis
 */

import type { FlatNode } from './flatten-ast';

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

type HeadingAnalysis = {
  isOrganizational: boolean;
  isReference: boolean;
  isProcedural: boolean;
  isQuestion: boolean;
  isDefinition: boolean;
  hasSequenceIndicator: boolean;
};

type ContentAnalysis = {
  codeBlockRatio: number;
  listItemRatio: number;
  questionCount: number;
  definitionPatterns: number;
  imperativeVerbs: number;
  avgTokensPerParagraph: number;
  hasCallToAction: boolean;
};

type StructureAnalysis = {
  hasParameterLists: boolean;
  hasReturnValues: boolean;
  hasOrderedSequence: boolean;
};

type ContextAnalysis = {
  followsSequentialPattern: boolean;
  isPartOfSeries: boolean;
  hasRelatedSections: boolean;
};

export type MergingDecision = {
  shouldMerge: boolean;
  confidence: number;
  reason: string;
};

// Keyword definitions for pattern detection
const ORGANIZATIONAL_KEYWORDS = [
  'setup', 'installation', 'install', 'configure', 'configuration',
  'getting started', 'prerequisites', 'requirements', 'dependencies',
  'preparation', 'initialization', 'deployment'
];

const REFERENCE_KEYWORDS = [
  'api', 'reference', 'method', 'function', 'class', 'interface',
  'property', 'parameter', 'argument', 'return', 'endpoint',
  'schema', 'specification', 'documentation'
];

const PROCEDURAL_KEYWORDS = [
  'how to', 'tutorial', 'guide', 'walkthrough', 'instructions',
  'step', 'example', 'usage', 'demonstration', 'practice'
];

const IMPERATIVE_VERBS = [
  'click', 'run', 'install', 'execute', 'start', 'stop', 'create',
  'delete', 'modify', 'update', 'configure', 'set', 'add', 'remove'
];

export function detectContentPattern(section: Section): ContentPattern {
  const scores = calculatePatternScores(section);
  return selectHighestScore(scores);
}

function calculatePatternScores(section: Section): Record<ContentPattern, number> {
  const headingAnalysis = analyzeHeading(section.heading.text);
  const contentAnalysis = analyzeContent(section.content);
  const structureAnalysis = analyzeStructure(section);
  const contextAnalysis = analyzeContext(section);

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

function selectHighestScore(scores: Record<ContentPattern, number>): ContentPattern {
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

// Heading Text Analysis
function analyzeHeading(headingText: string): HeadingAnalysis {
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

// Content Structure Analysis
function analyzeContent(content: FlatNode[]): ContentAnalysis {
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

function analyzeStructure(section: Section): StructureAnalysis {
  const contentText = section.content.map(node => node.text).join(' ').toLowerCase();

  return {
    hasParameterLists: /parameters?:|arguments?:|props?:/.test(contentText),
    hasReturnValues: /returns?:|response:|output:/.test(contentText),
    hasOrderedSequence: section.content.some(node =>
      node.type === 'list-item' && /^\d+\./.test(node.text.trim())
    )
  };
}

function analyzeContext(_section: Section): ContextAnalysis {
  // This requires access to document-level context
  // For now, return basic analysis - can be enhanced with document context
  return {
    followsSequentialPattern: false,
    isPartOfSeries: false,
    hasRelatedSections: false
  };
}

// Content analysis helper functions
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
  const callToActionWords = ['click', 'download', 'install', 'run', 'execute', 'start', 'begin'];
  const contentText = content.map(node => node.text).join(' ').toLowerCase();

  return callToActionWords.some(word => contentText.includes(word));
}

// Pattern Scoring Functions
function scoreOrganizational(
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

function scoreReference(
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

function scoreProcedural(
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

function scoreConceptual(
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

function scoreFAQ(heading: HeadingAnalysis, content: ContentAnalysis): number {
  let score = 0;

  if (heading.isQuestion) score += 0.5;
  if (content.questionCount > 0) score += 0.3;
  if (content.definitionPatterns > 0) score += 0.2;

  return Math.min(score, 1.0);
}

function scoreGlossary(heading: HeadingAnalysis, content: ContentAnalysis): number {
  let score = 0;

  if (heading.isDefinition) score += 0.4;
  if (content.definitionPatterns > 0) score += 0.4;
  if (content.avgTokensPerParagraph < 80) score += 0.2; // Concise definitions

  return Math.min(score, 1.0);
}

// Main merging decision function
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