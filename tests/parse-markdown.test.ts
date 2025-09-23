import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseMarkdown } from '../parse-markdown';

describe('parseMarkdown', () => {
  it('should parse simple markdown into an AST', () => {
    const input = '# Hello\n\nThis is a paragraph.';
    const ast = parseMarkdown(input);

    expect(ast.type).toBe('root');
    expect(ast.children).toHaveLength(2);
    expect(ast.children[0].type).toBe('heading');
    expect(ast.children[0].depth).toBe(1);
    expect(ast.children[1].type).toBe('paragraph');
  });

  it('should parse headings with correct depth', () => {
    const input = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const ast = parseMarkdown(input);

    expect(ast.children).toHaveLength(6);
    ast.children.forEach((child, index) => {
      expect(child.type).toBe('heading');
      expect(child.depth).toBe(index + 1);
    });
  });

  it('should parse code blocks with language', () => {
    const input = '```javascript\nconst x = 1;\n```';
    const ast = parseMarkdown(input);

    expect(ast.children[0].type).toBe('code');
    expect(ast.children[0].lang).toBe('javascript');
    expect(ast.children[0].value).toBe('const x = 1;');
  });

  it('should parse tables (GFM)', () => {
    const input = '| A | B |\n|---|---|\n| 1 | 2 |';
    const ast = parseMarkdown(input);

    expect(ast.children[0].type).toBe('table');
    expect(ast.children[0].children).toHaveLength(2); // header + row
  });

  it('should parse lists', () => {
    const input = '- Item 1\n- Item 2\n  - Nested\n- Item 3';
    const ast = parseMarkdown(input);

    expect(ast.children[0].type).toBe('list');
    expect(ast.children[0].children).toHaveLength(3);
    expect(ast.children[0].children?.[1].children?.[1].type).toBe('list'); // nested list
  });

  it('should handle empty input', () => {
    const ast = parseMarkdown('');
    expect(ast.type).toBe('root');
    expect(ast.children).toHaveLength(0);
  });

  it('should parse fixture file: simple.md', () => {
    const content = readFileSync(join(__dirname, 'fixtures/simple.md'), 'utf-8');
    const ast = parseMarkdown(content);

    expect(ast.type).toBe('root');
    expect(ast.children.length).toBeGreaterThan(0);

    // Check for main heading
    const mainHeading = ast.children.find(node => node.type === 'heading' && node.depth === 1);
    expect(mainHeading).toBeDefined();

    // Check for code block
    const codeBlock = ast.children.find(node => node.type === 'code');
    expect(codeBlock).toBeDefined();
    expect(codeBlock?.lang).toBe('javascript');

    // Check for table
    const table = ast.children.find(node => node.type === 'table');
    expect(table).toBeDefined();
  });

  it('should parse fixture file: headings.md', () => {
    const content = readFileSync(join(__dirname, 'fixtures/headings.md'), 'utf-8');
    const ast = parseMarkdown(content);

    expect(ast.type).toBe('root');

    // Count headings by depth
    const headings = ast.children.filter(node => node.type === 'heading');
    const depthCounts = headings.reduce((acc, heading) => {
      acc[heading.depth || 0] = (acc[heading.depth || 0] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    expect(depthCounts[1]).toBe(1); // One H1
    expect(depthCounts[2]).toBeGreaterThan(0); // Multiple H2s
    expect(depthCounts[3]).toBeGreaterThan(0); // Multiple H3s
  });

  it('should parse fixture file: code-heavy.md', () => {
    const content = readFileSync(join(__dirname, 'fixtures/code-heavy.md'), 'utf-8');
    const ast = parseMarkdown(content);

    expect(ast.type).toBe('root');

    // Check for multiple code blocks
    const codeBlocks = ast.children.filter(node => node.type === 'code');
    expect(codeBlocks.length).toBeGreaterThanOrEqual(3);

    // Check for different languages
    const languages = codeBlocks.map(block => block.lang).filter(Boolean);
    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
    expect(languages).toContain('bash');

    // Check for inline code in paragraphs
    const paragraphs = ast.children.filter(node => node.type === 'paragraph');
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  it('should preserve position information', () => {
    const input = 'Line 1\n\nLine 3';
    const ast = parseMarkdown(input);

    expect(ast.children[0].position).toBeDefined();
    expect(ast.children[0].position?.start.line).toBe(1);
    expect(ast.children[1].position?.start.line).toBe(3);
  });
});