# Chunker Refactor Task List

This document outlines the comprehensive refactor needed to align the current implementation with the enhanced specifications defined in `strategy.md` and the hierarchical splitting guidelines in `README.md`.

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

**Current State**: Documentation enhanced with clear hierarchical splitting rules and small chunk prevention strategy
**Target State**: Implementation aligned with updated strategy.md specifications for preprocessing optimization and intelligent merging

## Implementation Tasks

### Preprocessing Optimization
- [ ] Implement early single-chunk detection in main pipeline
  - [ ] Add total token count calculation before AST parsing
  - [ ] Create fast path: if `totalTokens <= maxTokens`, return single chunk
  - [ ] Skip AST parsing and complex splitting logic for small documents
  - [ ] Add performance metrics to measure optimization impact

### Small Chunk Prevention System
- [ ] Implement small chunk detection thresholds
  - [ ] Define tiny chunk threshold: `< minTokens` (64 tokens)
  - [ ] Define small chunk threshold: `< 0.6 * targetTokens` (~210 tokens)
  - [ ] Define acceptable chunk threshold: `>= 0.6 * targetTokens`
  - [ ] Add threshold calculations to configuration

- [ ] Implement intelligent merging logic
  - [ ] Create merge decision engine with `required`/`preferred`/`none` behaviors
  - [ ] Implement within-section merging (sibling H2s, H3s)
  - [ ] Add boundary protection (never merge across H1 sections)
  - [ ] Add size limits for merged chunks (`<= 1.2 * maxTokens`)

### Hierarchical Merging Rules
- [ ] Implement section-aware merging
  - [ ] Detect parent-child relationships (H1 > H2 > H3)
  - [ ] Implement sibling merging within same parent section
  - [ ] Add topical relation checking for cross-sibling merges
  - [ ] Prevent cross-H1-boundary merging

- [ ] Handle specific small chunk scenarios
  - [ ] Many small H2 sections: merge consecutive within same H1
  - [ ] Single tiny H3: merge up to parent H2 if H2 also small
  - [ ] Final small chunk: merge back to previous chunk
  - [ ] Orphaned sentences: merge with adjacent section

### Pipeline Integration
- [ ] Update main chunking pipeline to include new steps
  - [ ] Integrate early optimization check (step 2-3)
  - [ ] Add small chunk detection in node processing (step 8)
  - [ ] Apply intelligent merging in accumulation logic (step 10)
  - [ ] Update chunk flushing conditions (step 12)

### Testing & Validation
- [ ] Create test fixtures for small chunk scenarios
  - [ ] Multiple small H2 sections document
  - [ ] Mixed small/large sections document
  - [ ] Single tiny section document
  - [ ] Cross-section boundary test cases

- [ ] Add unit tests for new functionality
  - [ ] Early single-chunk detection tests
  - [ ] Small chunk threshold detection tests
  - [ ] Merging decision logic tests
  - [ ] Boundary protection tests

- [ ] Add integration tests
  - [ ] End-to-end small chunk prevention
  - [ ] Performance optimization verification
  - [ ] Quality guarantee validation (0 small chunks in multi-chunk docs)
