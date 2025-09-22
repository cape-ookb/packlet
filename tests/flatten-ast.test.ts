import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMarkdown } from '../parse-markdown';
import { flattenAst, type FlatNode } from '../flatten-ast';

describe('flattenAst', () => {
  it('should flatten simple heading and paragraph', () => {
    const input = '# Hello\n\nThis is a paragraph.';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    expect(flatNodes).toHaveLength(2);

    expect(flatNodes[0]).toEqual({
      type: 'heading',
      text: 'Hello',
      headingTrail: ['Hello'],
      depth: 1,
      position: expect.any(Object)
    });

    expect(flatNodes[1]).toEqual({
      type: 'paragraph',
      text: 'This is a paragraph.',
      headingTrail: ['Hello'],
      position: expect.any(Object)
    });
  });

  it('should maintain hierarchical heading trail', () => {
    const input = '# Main\n\nIntro paragraph.\n\n## Section\n\nSection content.\n\n### Subsection\n\nSubsection content.';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    expect(flatNodes).toHaveLength(6);

    // Main heading
    expect(flatNodes[0].headingTrail).toEqual(['Main']);

    // Intro paragraph under Main
    expect(flatNodes[1].headingTrail).toEqual(['Main']);

    // Section heading
    expect(flatNodes[2].headingTrail).toEqual(['Main', 'Section']);

    // Section content under Main > Section
    expect(flatNodes[3].headingTrail).toEqual(['Main', 'Section']);

    // Subsection heading
    expect(flatNodes[4].headingTrail).toEqual(['Main', 'Section', 'Subsection']);

    // Subsection content
    expect(flatNodes[5].headingTrail).toEqual(['Main', 'Section', 'Subsection']);
  });

  it('should handle code blocks with language', () => {
    const input = '# Code Example\n\n```javascript\nconst x = 1;\n```';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    expect(flatNodes).toHaveLength(2);

    expect(flatNodes[1]).toEqual({
      type: 'code',
      text: 'const x = 1;',
      headingTrail: ['Code Example'],
      lang: 'javascript',
      position: expect.any(Object)
    });
  });

  it('should handle list items individually', () => {
    const input = '# Lists\n\n- Item 1\n- Item 2\n- Item 3';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    const listItems = flatNodes.filter(node => node.type === 'list-item');
    expect(listItems).toHaveLength(3);

    expect(listItems[0].text).toBe('Item 1');
    expect(listItems[1].text).toBe('Item 2');
    expect(listItems[2].text).toBe('Item 3');

    listItems.forEach(item => {
      expect(item.headingTrail).toEqual(['Lists']);
    });
  });

  it('should handle tables', () => {
    const input = '# Data\n\n| A | B |\n|---|---|\n| 1 | 2 |';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    const tableNode = flatNodes.find(node => node.type === 'table');
    expect(tableNode).toBeDefined();
    expect(tableNode?.headingTrail).toEqual(['Data']);
    expect(tableNode?.text).toContain('A');
    expect(tableNode?.text).toContain('B');
  });

  it('should handle blockquotes', () => {
    const input = '# Quote\n\n> This is a blockquote\n> with multiple lines.';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    const blockquoteNode = flatNodes.find(node => node.type === 'blockquote');
    expect(blockquoteNode).toBeDefined();
    expect(blockquoteNode?.headingTrail).toEqual(['Quote']);
    expect(blockquoteNode?.text).toContain('This is a blockquote');
  });

  it('should handle empty input', () => {
    const ast = parseMarkdown('');
    const flatNodes = flattenAst(ast);
    expect(flatNodes).toHaveLength(0);
  });

  it('should handle nested lists correctly', () => {
    const input = '# Tasks\n\n- Main task\n  - Subtask 1\n  - Subtask 2\n- Another main task';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    const listItems = flatNodes.filter(node => node.type === 'list-item');
    expect(listItems.length).toBeGreaterThanOrEqual(2);

    listItems.forEach(item => {
      expect(item.headingTrail).toEqual(['Tasks']);
    });
  });

  it('should reset heading trail correctly when depth decreases', () => {
    const input = '# Main\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B.';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    expect(flatNodes[0].headingTrail).toEqual(['Main']);
    expect(flatNodes[1].headingTrail).toEqual(['Main', 'Section A']);
    expect(flatNodes[2].headingTrail).toEqual(['Main', 'Section A']);
    expect(flatNodes[3].headingTrail).toEqual(['Main', 'Section B']);
    expect(flatNodes[4].headingTrail).toEqual(['Main', 'Section B']);
  });

  it('should preserve position information', () => {
    const input = '# Title\n\nParagraph text.';
    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    flatNodes.forEach(node => {
      expect(node.position).toBeDefined();
      expect(node.position?.start).toBeDefined();
      expect(node.position?.end).toBeDefined();
    });
  });

  it('should parse fixture file: simple.md', () => {
    const content = readFileSync(join(__dirname, 'fixtures/simple.md'), 'utf-8');
    const ast = parseMarkdown(content);
    const flatNodes = flattenAst(ast);

    expect(flatNodes.length).toBeGreaterThan(0);

    // Should have main heading
    const mainHeading = flatNodes.find(node => node.type === 'heading' && node.text === 'Simple Document');
    expect(mainHeading).toBeDefined();

    // Should have code block
    const codeBlock = flatNodes.find(node => node.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock?.lang).toBe('javascript');

    // Should have table
    const table = flatNodes.find(node => node.type === 'table');
    expect(table).toBeDefined();

    // Should have list items
    const listItems = flatNodes.filter(node => node.type === 'list-item');
    expect(listItems.length).toBeGreaterThan(0);

    // All nodes should have proper heading trails
    flatNodes.forEach(node => {
      expect(Array.isArray(node.headingTrail)).toBe(true);
      expect(node.headingTrail.length).toBeGreaterThan(0);
    });
  });

  it('should handle complex nested structure', () => {
    const input = `# Main Title

Introduction paragraph.

## First Section

Section intro.

### Subsection A

Content A.

#### Deep Level

Deep content.

### Subsection B

Content B.

## Second Section

Final content.`;

    const ast = parseMarkdown(input);
    const flatNodes = flattenAst(ast);

    // Check heading trail evolution
    const expectedTrails = [
      ['Main Title'],                              // Main Title
      ['Main Title'],                              // Introduction paragraph
      ['Main Title', 'First Section'],             // First Section
      ['Main Title', 'First Section'],             // Section intro
      ['Main Title', 'First Section', 'Subsection A'], // Subsection A
      ['Main Title', 'First Section', 'Subsection A'], // Content A
      ['Main Title', 'First Section', 'Subsection A', 'Deep Level'], // Deep Level
      ['Main Title', 'First Section', 'Subsection A', 'Deep Level'], // Deep content
      ['Main Title', 'First Section', 'Subsection B'], // Subsection B
      ['Main Title', 'First Section', 'Subsection B'], // Content B
      ['Main Title', 'Second Section'],            // Second Section
      ['Main Title', 'Second Section']             // Final content
    ];

    expect(flatNodes).toHaveLength(expectedTrails.length);

    flatNodes.forEach((node, index) => {
      expect(node.headingTrail).toEqual(expectedTrails[index]);
    });
  });
});