---
name: feature-delivery-loop
description: Run an end-to-end feature/fix/PR workflow with requirement discovery, exhaustive clarification, explicit plan approval, Beads-tracked execution progress, and iterative review/fix loops until no bugs or edge cases remain.
---

# Feature Delivery Loop

Use this skill when the user wants a feature, fix, or PR handled from planning through execution and hardening.

## Non-Negotiable Rules

1. Ground in repository reality before proposing implementation details.
2. Ask questions until requirements are decision complete.
3. Generate a local, untracked plan file at `docs/plans/<slug>.md` before implementation.
4. Require explicit user approval before any mutating implementation step.
5. Review all code changes for bugs, regressions, missed edge cases, and project guideline compliance.
6. Fix findings and repeat review until the stop condition is met.
7. Stop only when the review checklist is clean and targeted checks/tests are green.
8. Plan files are ephemeral PR artifacts and must not be committed.
9. Track plan and delivery progress in Beads for the full lifecycle of the task.
10. Every mutating edit batch must be followed by an explicit review pass before moving on.
11. Passing lint/tests is supporting evidence, not a substitute for scenario and edge-case review.

## Stage Workflow

### Stage 0: Beads Tracking Setup

1. Determine whether a Beads issue already exists for the request.
2. If no issue exists, create one and capture the issue ID:

```bash
bd create "<title>" --type task --description "<summary>" --silent
```

3. Keep the issue ID available as the source-of-truth tracking key for the task.
4. If `bd` is unavailable, ask the user whether to initialize Beads or explicitly waive Beads tracking for this task before proceeding.

### Stage 1: Intake and Context

1. Confirm request type: `feature`, `fix`, or `PR hardening`.
2. Inspect relevant codepaths, configs, types, and existing tests.
3. Capture current behavior and likely impact surface.
4. Post a Beads comment summarizing intake context and planned discovery focus.

### Stage 2: Requirement Clarification Loop

Keep asking questions until all of these are explicit:

1. Goal and success criteria.
2. In-scope and out-of-scope behavior.
3. Audience and usage context.
4. Constraints and non-goals.
5. Rollback or compatibility expectations.
6. Test and acceptance expectations.

If any item is unresolved, continue asking questions.

### Stage 3: Plan File Generation

Create `docs/plans/<slug>.md` as an untracked local artifact with this structure:

```markdown
# <Task Title>

## Summary

## Context

## Requirements

## Questions Resolved

## In Scope

## Out of Scope

## Public Interfaces and Type Changes

## Implementation Steps

## Test Strategy

## Risk and Edge-Case Checklist

## Approval Status

- Requested by agent on: <timestamp>
- Approved by user: <yes/no + timestamp>

## Beads Tracking

- Issue ID: <bd-xxx>
- Current status: <open|in_progress|done>
- Last progress update: <timestamp>
```

`<slug>` must be a concise kebab-case name derived from the request.
If the plan file is accidentally staged, unstage it before continuing.
After creating or updating the plan, add a Beads comment with plan path and summary.

### Stage 4: Approval Gate

Before implementation:

1. Present the plan summary and plan file path.
2. Ask for explicit approval.
3. Do not implement until user approval is explicit (`yes`, `approved`, or equivalent).
4. Record approval decision in Beads comments.

If the user requests plan changes, update the plan and ask for approval again.

### Stage 5: Execute Plan

1. Implement exactly what is approved.
2. Keep scope aligned to plan.
3. Update the plan file progress as work completes.
4. Set Beads issue status to `in_progress` at execution start:

```bash
bd update <issue-id> --status in_progress
```

5. Add Beads progress comments at meaningful milestones (completed steps, blockers, scope clarifications).
6. After each mutating edit batch, run a micro-review checkpoint:

```bash
jj diff --name-only
jj diff -- <changed-file>
```

Do not continue implementing the next batch until this checkpoint is complete.

### Stage 6: Review for Bugs, Edge Cases, and Project Guidelines

Review with a findings-first mindset:

1. Functional regressions.
2. Input validation and malformed/empty states.
3. Error handling, retries, and failure paths.
4. Concurrency/race conditions and stale state.
5. Permissions, auth, and security boundaries.
6. API/type contract mismatches.
7. Missing tests for changed behavior.
8. Conformance with project-recommended conventions and practices (read and enforce AGENTS.md, CLAUDE.md, and applicable skill guidance).

Mandatory review protocol for every changed file:

1. Diff-driven inspection with line-level evidence (`path:line`) for each finding or explicit pass note.
2. State transition matrix for stateful flows (forms/dialogs/async UI):
   - Local pristine + upstream unchanged
   - Local pristine + upstream changed
   - Local dirty + upstream unchanged
   - Local dirty + upstream changed
   - Submit/action behavior under each relevant state
   - Close/reopen/reset behavior
3. Confirm there is no silent stale overwrite path (for example, submitting stale server-backed values without warning or guard).
4. Cover negative paths explicitly: cancel, retry, partial failure, disabled actions, and empty/loading/error states.
5. For each changed behavior, require either:
   - an automated test, or
   - a documented manual scenario with steps and expected results.
6. Record review evidence in the final report and in Beads iteration comments.

### Stage 7: Fix and Repeat

1. Fix all findings from Stage 6.
2. Re-run relevant tests/checks.
3. Re-review all touched files (not only the last edited file) for new regressions.
4. Add a Beads comment for each review/fix iteration, including findings summary and resolution status.
5. Repeat Stages 6 and 7 until no findings remain.

## Stop Condition

You may finish only when all are true:

1. Review checklist has zero unresolved findings.
2. Targeted tests/checks relevant to the changes are green.
3. Guideline/practice compliance checks have zero unresolved findings.
4. Plan file reflects final implemented state.
5. Every changed file has explicit review evidence (finding or pass note), including edge-case/state coverage.
6. Each changed behavior has validation evidence (automated test or documented manual scenario).
7. Beads issue is updated with final summary and marked complete:

```bash
bd update <issue-id> --status done
```

If checks cannot run, report why, what was attempted, and residual risk.

## Output Format for Review Findings

When reviewing, report findings in severity order with file references:

1. `Severity` (`high` | `medium` | `low`)
2. `Issue`
3. `Evidence` (`path:line`)
4. `Fix`
5. `Status`
6. `Validation` (`test added` | `existing test run` | `manual scenario`)
