# Chunker Refactor Task List

This document outlines the comprehensive refactor needed to align the current implementation with the new chunk output format specification defined in `chunk-output-format.md` and `title-in-each-chunk.md`.

## Dev Process

- Work on one task at a time.
- **IMPORTANT: Once complete, check off tasks in any and all docs by changing `[ ]` to `[x]`.**
- **ALWAYS mark tasks as complete immediately after finishing them - don't batch multiple completions.**
- Ask before continuing onto the next task.

## Task Completion Instructions

**Before marking a task complete:**
1. Verify the functionality works as specified
2. Run relevant tests to ensure nothing breaks
3. Check that the implementation matches the requirements in the referenced documentation
4. Update this file by changing `- [ ]` to `- [x]` for completed tasks

**When marking tasks complete:**
- Mark individual sub-tasks as `[x]` when done
- Mark the parent task/section as complete only when ALL sub-tasks are done
- Be specific - if only part of a task is done, only mark that specific part
- If you discover a task needs to be split into smaller parts, update the task list accordingly

## Overview

**Current State**: The implementation uses legacy field names and is missing several required fields.
**Target State**: Full compliance with the new chunk output format specification.
**Key Gap**: `Chunk` type uses outdated field names and missing critical metadata fields.

## Phase 1: Core Type Definitions (HIGH PRIORITY)

### 1.1 Update Chunk Type Definition
**File**: `lib/types.ts`
**References**:
- `chunk-output-format.md:250-258` (Required Type Updates)
- `title-in-each-chunk.md:231-242` (Type Definition Updates Required)

**Tasks**:
- [x] Rename `displayMarkdown` → `originalText`
- [x] Rename `charOffsets` → `sourcePosition`
- [x] Rename `sourceLength` → `totalChars` (within sourcePosition object)
- [x] Update `tokenCount` → `tokenStats.tokens` object structure
- [ ] Remove top-level structural fields and move to metadata object:
  - [x] Move `contentType` → `metadata.contentType`
  - [x] Move `heading` → `metadata.sectionTitle`
  - [x] Move `headingTrail` → `metadata.headerPath`
- [ ] Add missing fields in metadata object:
  - [x] `metadata.fileTitle: string`
  - [x] `metadata.headerBreadcrumb: string`
  - [x] `metadata.headerDepths: number[]`
  - [x] `metadata.headerSlugs: string[]`
  - [x] `metadata.sectionSlug: string`
  - [x] `metadata.sourceFile: string`
  - [x] `metadata.nodeTypes: string[]`
  - [x] `metadata.processedAt: string`
  - [x] `metadata.chunkingOptions: object`
- [ ] Add missing top-level fields:
  - [x] `embedText: string`
  - [x] `tokenStats: { tokens: number, estimatedTokens: number }`
  - [x] `pipeline: { version: string, processingTimeMs: number }`

### 1.2 Add ChunkOptions Configuration
**File**: `lib/types.ts`, `lib/default-config.ts`
**References**: `title-in-each-chunk.md:207-211`

**Tasks**:
- [x] Add `breadcrumbMode?: "conditional" | "always" | "none"` to ChunkOptions
- [x] Set default to "conditional" in default config
- [x] Add `fileTitle: string` parameter requirement to main function signature

## Phase 2: Metadata Generation Updates (HIGH PRIORITY)

### 2.1 Update Metadata Attachment Function
**File**: `lib/metadata.ts` (lines 119-150)
**References**:
- `chunk-output-format.md:240-246` (Implementation Gap)
- `title-in-each-chunk.md:177-186` (Add missing metadata fields)

**Tasks**:
- [x] Accept `fileTitle` as required parameter from calling code
- [ ] Build metadata object with all structural fields:
  - [x] `metadata.contentType` from content type parameter
  - [x] `metadata.sourceFile` from original filename
  - [x] `metadata.fileTitle` from fileTitle parameter
  - [x] `metadata.headerPath` from header hierarchy
  - [x] `metadata.headerBreadcrumb` as `headerPath.join(" > ")`
  - [x] `metadata.headerDepths` array tracking depth of each heading
  - [x] `metadata.headerSlugs` array using github-slugger
  - [x] `metadata.sectionSlug` as last item from `headerSlugs`
  - [x] `metadata.sectionTitle` as last item from `headerPath`
  - [x] `metadata.nodeTypes` from AST node analysis
  - [x] `metadata.processedAt` as ISO8601 timestamp
  - [x] `chunkingOptions` moved to top-level (not in metadata)
- [x] Update tokenStats to object format: `{ tokens: number, estimatedTokens: number }`
- [x] Add pipeline object: `{ version: string, processingTimeMs: number }`

### 2.2 Fix Header Path Building Logic
**File**: `lib/flatten-ast.ts`
**References**: `title-in-each-chunk.md:188-194`

**Tasks**:
- [x] Ensure `metadata.headerPath` contains only heading text (no `#` symbols)
- [x] Keep `metadata.headerPath` separate from `metadata.fileTitle`
- [x] Handle multiple H1s correctly (first is root, later start new sections)
- [x] Handle edge case when no H1 present (start at first heading found)
- [x] Never mix `fileTitle` into `headerPath` array
- [x] Store all header-related data in metadata object for vector DB filtering

## Phase 3: Embed Text Generation (MEDIUM PRIORITY)

### 3.1 Create Conditional Breadcrumb System
**File**: Create new `lib/embed-text.ts`
**References**: `title-in-each-chunk.md:197-206`

**Tasks**:
- [x] Create function that reads metadata but doesn't modify it
- [x] Implement detection logic:
  - [x] Chunk starts new section (contains heading node)
  - [x] Context-less chunks (code-only, table-only, list-only)
  - [x] Short chunks (< minTokens + overlap)
- [x] Build `fullBreadcrumb` when `fileTitle !== headerPath[0]`
- [x] Add deduplication (don't add if chunk starts with exact heading)
- [x] Implement 160-char truncation with middle ellipsis
- [x] Generate `embedText` field based on `breadcrumbMode` setting

### 3.2 Implement Breadcrumb Mode Logic
**References**: `title-in-each-chunk.md:207-211`

**Tasks**:
- [ ] "conditional" mode: Smart context detection
- [ ] "always" mode: Always prepend full breadcrumb
- [ ] "none" mode: Never prepend (`embedText` = `originalText`)

## Phase 4: Pipeline Integration (MEDIUM PRIORITY)

### 4.1 Update Main Pipeline Function
**File**: `lib/index.ts`
**References**: `title-in-each-chunk.md:214-218`

**Tasks**:
- [ ] Add `fileTitle: string` as required parameter
- [ ] Pass `fileTitle` through pipeline to metadata stage
- [x] Updated return type to unified `Chunk[]` with enhanced fields
- [ ] Integrate embed text generation step
- [ ] Document that calling code handles frontmatter/title extraction

### 4.2 Add Slug Generation Dependency
**References**: `title-in-each-chunk.md:219-224`

**Tasks**:
- [ ] Install `github-slugger` dependency
- [ ] Generate slugs for each heading in `headerPath`
- [ ] Handle slug collisions (github-slugger auto-appends numbers)
- [ ] Store in `headerSlugs` array with `sectionSlug` as last item

## Phase 5: Testing & Validation (LOW PRIORITY)

### 5.1 Core Functionality Tests
**References**: `title-in-each-chunk.md:244-256`

**Tasks**:
- [ ] Test `fileTitle` parameter handling (required validation)
- [ ] Test `headerBreadcrumb` building with " > " separator
- [ ] Test breadcrumb prepending logic (all conditions)
- [ ] Test edge cases (no H1, multiple H1s, no headings)
- [ ] Test 160-char truncation with middle ellipsis
- [ ] Test `sectionTitle` extraction (last item from `headerPath`)
- [ ] Test `headerDepths` array generation
- [ ] Test github-slugger integration
- [ ] Test slug collision handling

### 5.2 Update Existing Tests
**Tasks**:
- [ ] Update existing tests that may break with new metadata fields
- [ ] Ensure ≥90% test coverage maintained
- [ ] Test backward compatibility where possible

## Phase 6: Documentation & Cleanup (LOW PRIORITY)

### 6.1 Update Implementation Status
**File**: `docs/chunk-output-format.md`
**References**: `chunk-output-format.md:234-246`

**Tasks**:
- [ ] Update implementation status section
- [ ] Remove "Implementation Gap" warnings
- [ ] Mark specification as implemented

### 6.2 Field Migration Documentation
**References**: `chunk-output-format.md:260-285`

**Tasks**:
- [ ] Create migration guide for consumers
- [ ] Document breaking changes
- [ ] Provide field mapping table for legacy systems

## Critical Implementation Notes

**Key Breaking Changes**:
1. **Metadata restructure**: Most structural fields moved to `metadata` object for vector database filtering
2. `sourcePosition` excludes breadcrumb modifications (positions are source-only)
3. `metadata.headerBreadcrumb` never includes `metadata.fileTitle` (separated for clarity)
4. `fileTitle` is now a required parameter from calling code
5. Token information moved to structured `tokenStats` object
6. Pipeline information separated from metadata in dedicated `pipeline` object
7. `contentType` moved to `metadata.contentType` for filtering

**Data Flow**:
- Metadata object contains **all fields useful for vector database filtering**
- Metadata fields are **always consistent** and **never modified** after creation
- Context prepending only affects `embedText`, not metadata
- `originalText` preserves exact formatting for display
- `embedText` includes context breadcrumbs for search optimization
- Pipeline information stored separately from metadata for clarity

**Pipeline Flow**:
`parseMarkdown` → `flattenAst` → `splitOversized` → `packNodes` → `addOverlap` → `normalizeChunks` → `attachMetadata` → `generateEmbedText` → `addPipelineInfo` → `assertOrFilterInvalid`

**Key Implementation Changes**:
- `attachMetadata` now creates structured metadata object with all filtering fields
- `generateEmbedText` reads from metadata but doesn't modify it
- `addPipelineInfo` adds processing information separately from metadata

## Dependencies

- `github-slugger`: For URL-safe anchor ID generation
- `tiktoken`: For accurate token counting (existing)

## Success Criteria

- [ ] All tests pass with ≥90% coverage
- [x] `Chunk` type updated with all enhanced fields and metadata object
- [ ] Output format complies with `chunk-output-format.md`
- [ ] Breadcrumb logic follows `title-in-each-chunk.md` rules
- [ ] Metadata object contains all vector database filtering fields
- [ ] Pipeline information separated from metadata
- [ ] No breaking changes to core pipeline architecture
- [ ] Migration guide available for consumers