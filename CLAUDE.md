# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

See `@README.md` for complete project overview, architecture, design principles, and development commands.

## Claude Code Specific Guidance

### Development Workflow
- No build tools required - run TypeScript files directly with `npx tsx`
- All core functions should be pure (no side effects) and ≤25 lines
- Use functional composition via `flow()` utility, not method chaining
- Test individual modules by running them directly

### Key Implementation Notes
- Token counting uses tiktoken with character-based fallback
- AST flattening algorithm details are in `flatten-ast.md`
- Pipeline processes: parse → flatten → split → pack → overlap → normalize → metadata → validate
- Each pipeline stage is a pure function that transforms data

### Testing Strategy
- Target ≥90% test coverage for core chunker modules
- Each function needs success and edge-case tests
- Use Vitest for unit testing
- Functions should be individually testable

### Code Standards
- Filenames use `kebab-case.ext`
- Functions: ≤3 parameters (prefer options object)
- Cyclomatic complexity ≤5
- No I/O or timing in core functions (only in boundary adapters)