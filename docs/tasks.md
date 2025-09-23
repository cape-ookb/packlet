# Chunker Refactor Task List

This document outlines the comprehensive refactor needed to align the current implementation with the new chunk output format specification defined in `chunk-output-format.md` and `title-in-each-chunk.md`.

## Overview

**Current State**: The implementation uses legacy field names and is missing several required fields.
**Target State**: Full compliance with the new chunk output format specification.
**Key Gap**: `EnhancedChunk` type uses outdated field names and missing critical metadata fields.

## Phase 1: Core Type Definitions (HIGH PRIORITY)

### 1.1 Update EnhancedChunk Type Definition
**File**: `lib/types.ts`
**References**:
- `chunk-output-format.md:250-258` (Required Type Updates)
- `title-in-each-chunk.md:231-242` (Type Definition Updates Required)

**Tasks**:
- [ ] Rename `displayMarkdown` → `originalText`
- [ ] Rename `charOffsets` → `sourcePosition`
- [ ] Rename `sourceLength` → `totalChars` (within sourcePosition object)
- [ ] Rename `heading` → `sectionTitle`
- [ ] Rename `headingTrail` → `headerPath` (if exists)
- [ ] Update `tokenCount` → `tokenStats.tokens` object structure
- [ ] Add missing required fields:
  - [ ] `fileTitle: string`
  - [ ] `headerBreadcrumb: string`
  - [ ] `headerDepths: number[]`
  - [ ] `headerSlugs: string[]`
  - [ ] `sectionSlug: string`
  - [ ] `embedText: string`
  - [ ] `tokenStats: { tokens: number, estimatedTokens: number }`

### 1.2 Add ChunkOptions Configuration
**File**: `lib/types.ts`, `lib/default-config.ts`
**References**: `title-in-each-chunk.md:207-211`

**Tasks**:
- [ ] Add `breadcrumbMode?: "conditional" | "always" | "none"` to ChunkOptions
- [ ] Set default to "conditional" in default config
- [ ] Add `fileTitle: string` parameter requirement to main function signature

## Phase 2: Metadata Generation Updates (HIGH PRIORITY)

### 2.1 Update Metadata Attachment Function
**File**: `lib/metadata.ts` (lines 119-150)
**References**:
- `chunk-output-format.md:240-246` (Implementation Gap)
- `title-in-each-chunk.md:177-186` (Add missing metadata fields)

**Tasks**:
- [ ] Accept `fileTitle` as required parameter from calling code
- [ ] Generate `headerBreadcrumb` as `headerPath.join(" > ")`
- [ ] Build `headerDepths` array tracking depth of each heading
- [ ] Generate `headerSlugs` array using github-slugger
- [ ] Set `sectionSlug` as last item from `headerSlugs`
- [ ] Set `sectionTitle` as last item from `headerPath`
- [ ] Update tokenStats to object format: `{ tokens: number, estimatedTokens: number }`

### 2.2 Fix Header Path Building Logic
**File**: `lib/flatten-ast.ts`
**References**: `title-in-each-chunk.md:188-194`

**Tasks**:
- [ ] Ensure `headerPath` contains only heading text (no `#` symbols)
- [ ] Keep `headerPath` separate from `fileTitle`
- [ ] Handle multiple H1s correctly (first is root, later start new sections)
- [ ] Handle edge case when no H1 present (start at first heading found)
- [ ] Never mix `fileTitle` into `headerPath` array

## Phase 3: Embed Text Generation (MEDIUM PRIORITY)

### 3.1 Create Conditional Breadcrumb System
**File**: Create new `lib/embed-text.ts`
**References**: `title-in-each-chunk.md:197-206`

**Tasks**:
- [ ] Create function that reads metadata but doesn't modify it
- [ ] Implement detection logic:
  - [ ] Chunk starts new section (contains heading node)
  - [ ] Context-less chunks (code-only, table-only, list-only)
  - [ ] Short chunks (< minTokens + overlap)
- [ ] Build `fullBreadcrumb` when `fileTitle !== headerPath[0]`
- [ ] Add deduplication (don't add if chunk starts with exact heading)
- [ ] Implement 160-char truncation with middle ellipsis
- [ ] Generate `embedText` field based on `breadcrumbMode` setting

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
- [ ] Update return type from `Chunk[]` to `EnhancedChunk[]`
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
1. `sourcePosition` excludes breadcrumb modifications (positions are source-only)
2. `headerBreadcrumb` never includes `fileTitle` (separated for clarity)
3. `fileTitle` is now a required parameter from calling code
4. Token information moved to structured `tokenStats` object

**Data Flow**:
- Metadata fields are **always consistent** and **never modified**
- Context prepending only affects `embedText`, not metadata
- `originalText` preserves exact formatting for display
- `embedText` includes context breadcrumbs for search optimization

**Pipeline Flow**:
`parseMarkdown` → `flattenAst` → `splitOversized` → `packNodes` → `addOverlap` → `normalizeChunks` → `attachMetadata` → `generateEmbedText` → `assertOrFilterInvalid`

## Dependencies

- `github-slugger`: For URL-safe anchor ID generation
- `tiktoken`: For accurate token counting (existing)

## Success Criteria

- [ ] All tests pass with ≥90% coverage
- [ ] `EnhancedChunk` type matches specification exactly
- [ ] Output format complies with `chunk-output-format.md`
- [ ] Breadcrumb logic follows `title-in-each-chunk.md` rules
- [ ] No breaking changes to core pipeline architecture
- [ ] Backward compatibility maintained where feasible