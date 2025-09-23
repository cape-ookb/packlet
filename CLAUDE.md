# CLAUDE.md

This file provides guidance to AI LLM code helpers like Claude when working with code in this repository.

## Project Overview

See `README.md` for complete project overview, architecture, design principles, and development commands.

## Code Specific Guidance

### Development Workflow
- Use functional composition via `flow()` utility, not method chaining
- Test individual modules by running them directly
- Each function ideally under 25 lines, single responsibility

### Key Implementation Notes
- Token counting uses tiktoken with character-based fallback
- AST flattening algorithm details are in `docs/flatten-ast.md`
- Pipeline processes: parse → flatten → split → pack → overlap → normalize → metadata → validate
- Each pipeline stage is a pure function that transforms data

### Testing Strategy
- Target ≥90% test coverage for core chunker modules
- Each function needs success and edge-case tests
- Use Vitest for unit testing
- Functions should be individually testable
- See `README.md` for how to run tests

### Code Standards
- Filenames use `kebab-case.ext`

#### Function Standards
- All core functions should be pure (no side effects) and ≤25 lines
- ≤3 parameters (prefer single typed options object)
  - **When to use objects**: If you have 3+ related parameters or 2+ parameters that are commonly passed together
  - **Examples**: `ProcessingContext { headingTrail, headingDepths, node }` instead of 3 separate params
  - **Benefits**: Easier to extend, cleaner signatures, better type safety
- Cyclomatic complexity ≤5
- No I/O or timing in core functions (only in boundary adapters)
- Small, Testable, Pure Functions
- Single responsibility: Each function does exactly one conceptual thing (parse, measure, pack, overlap, normalize, or annotate).
- Size cap: Aim ≤ 25 lines body; hard cap 40. If it grows, split it.
- For loops should call a function inside them instead of inline code.
- Determinism: Same inputs → same outputs. No hidden globals.
- Composition: Multi-step tasks small functions; no “god” functions.
- Unit tests per function (Vitest). Each has success and edge-case tests.


### Temporary Scripts
- One-off scripts for generating test fixtures, data analysis, or debugging can be saved in `tmp/` directory
- These scripts are not part of the main codebase but may be useful for future reference
- Examples: fixture generators, data converters, analysis scripts