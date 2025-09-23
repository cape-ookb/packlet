# Testing Guidelines

## 🚨 CRITICAL: Always Use Fixtures for Test Data

### The Golden Rule
**NEVER use inline markdown strings in integration or end-to-end tests. ALWAYS use fixture files.**

### Why Fixtures?

1. **Reusability**: Same test documents across multiple test suites
2. **Maintainability**: Update test data in one place
3. **Realism**: Test with actual document structures
4. **Clarity**: Tests focus on behavior, not test data creation
5. **Performance**: Load once, use many times

### How to Use Fixtures

#### Loading Fixtures
```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

// Load a fixture file
const content = readFileSync(join(__dirname, 'fixtures', 'simple.md'), 'utf-8');

// Use in your test
const result = chunkMarkdown(content, 'simple.md', options);
```

#### Available Fixtures
Located in `tests/fixtures/`:
- `simple.md` - Basic markdown with common elements
- `headings.md` - Complex heading hierarchies
- `code-heavy.md` - Documents with extensive code blocks
- `large-nodes.md` - Testing token limit handling
- `small-nodes.md` - Testing look-ahead merging
- `mixed-content.md` - Various node types
- `special-characters.md` - Special chars and formatting
- `duplicate-headings.md` - Collision handling scenarios
- `multi-h1.md` - Multiple top-level headings
- `heading-gaps.md` - Heading level gaps

#### Creating New Fixtures
When you need to test a specific scenario:

1. **Create a meaningful fixture file**:
   ```bash
   # Create fixture for your specific test case
   touch tests/fixtures/my-test-case.md
   ```

2. **Name it descriptively**:
   - ✅ `nested-lists.md`
   - ✅ `table-heavy.md`
   - ✅ `unicode-content.md`
   - ❌ `test1.md`
   - ❌ `temp.md`

3. **Document the purpose**:
   ```markdown
   <!-- tests/fixtures/nested-lists.md -->
   # Nested Lists Test Fixture

   This fixture tests deeply nested list structures...
   ```

### When to Use Inline Strings (Rare Exceptions)

Only use inline strings for:

1. **Unit tests of pure functions**:
   ```typescript
   // ✅ OK - Testing a single pure function
   it('should clean markdown from heading', () => {
     const heading = '**Bold** and `Code`';
     const result = cleanMarkdownFromHeading(heading);
     expect(result).toBe('Bold and Code');
   });
   ```

2. **Testing edge cases with minimal input**:
   ```typescript
   // ✅ OK - Testing empty input edge case
   it('should handle empty string', () => {
     const result = parseMarkdown('');
     expect(result).toBeDefined();
   });
   ```

### Examples

#### ❌ BAD: Inline Markdown in Integration Tests
```typescript
// DON'T DO THIS
it('should chunk a document correctly', () => {
  const doc = `# Title

  This is a paragraph with some content.

  ## Section

  More content here...`;

  const result = chunkMarkdown(doc, 'test.md', options);
  // ...
});
```

#### ✅ GOOD: Using Fixtures
```typescript
// DO THIS INSTEAD
it('should chunk a document correctly', () => {
  const content = readFileSync(join(__dirname, 'fixtures', 'simple.md'), 'utf-8');
  const result = chunkMarkdown(content, 'simple.md', options);
  // ...
});
```

#### ✅ GOOD: Creating Specific Fixtures
```typescript
// When you need specific test data, create a fixture
it('should handle documents with emoji', () => {
  // First, create tests/fixtures/emoji-content.md with your test case
  const content = readFileSync(join(__dirname, 'fixtures', 'emoji-content.md'), 'utf-8');
  const result = chunkMarkdown(content, 'emoji-content.md', options);
  // ...
});
```

## Test Organization

### Directory Structure
```
tests/
├── fixtures/           # All test documents
│   ├── simple.md
│   ├── complex.md
│   └── edge-cases.md
├── unit/              # Unit tests (may use inline strings sparingly)
│   └── helpers.test.ts
└── integration/       # Integration tests (MUST use fixtures)
    └── chunking.test.ts
```

### Test Naming Conventions
- Test files: `*.test.ts` or `*.spec.ts`
- Fixture files: `descriptive-name.md`
- Test suites: Use `describe()` blocks
- Test cases: Start with "should" for clarity

### Coverage Requirements
- Core modules: ≥90% coverage
- Helper functions: ≥80% coverage
- Always test:
  - Happy path
  - Edge cases
  - Error conditions
  - Boundary values

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test:run chunking

# Run with coverage
pnpm test:coverage
```

## Best Practices

1. **One assertion per test** (when possible)
2. **Descriptive test names** that explain the expected behavior
3. **Arrange-Act-Assert** pattern
4. **Independent tests** that don't rely on execution order
5. **Fast tests** - mock expensive operations
6. **Deterministic tests** - no random data or timing dependencies

## Remember

> **The goal of tests is to provide confidence that the code works as expected. Using fixtures ensures we're testing against realistic data that matches production use cases.**

### Quick Checklist

Before submitting a PR, ensure:
- [ ] All tests use fixtures for markdown content (unless justified exception)
- [ ] New fixtures are properly named and documented
- [ ] Tests are clear and focused
- [ ] Coverage meets requirements
- [ ] No inline markdown strings in integration tests