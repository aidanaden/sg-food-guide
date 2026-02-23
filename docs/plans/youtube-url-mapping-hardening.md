# YouTube URL Mapping Hardening

## Summary

Ensure stall YouTube links are correct and avoid false-positive assignments. Harden matching logic to prioritize precise matches and prevent generic-token mislinks. Re-run production sync and validate unresolved cases.

## Context

- Current production has 140 active stalls; 3 stalls are missing YouTube URLs.
- At least one incorrect mapping exists (`seng-huat-bak-kut-teh-restaurant-f86041e` mapped to `#bakkutteh` short via weak token scoring).
- Source sheet includes mixed YouTube reference formats: watch URLs, video IDs, titles, and members-only text labels.

## Requirements

- Prevent incorrect YouTube URL assignment from weak token overlap.
- Preserve correct existing mappings.
- Keep unresolved stalls null instead of forcing low-confidence links.
- Re-run sync in prod and verify counts + spot-check known problematic stalls.

## Questions Resolved

- User requested proceeding immediately and ensuring proper stall YouTube mapping.
- Quality priority is correctness over forced completeness.

## In Scope

- Tighten matching heuristics in sync pipeline.
- Add safeguards against generic/cuisine token-only matches.
- Validate via sync dry-run + apply + D1 verification queries.

## Out of Scope

- Accessing members-only/private YouTube content that is unavailable to public APIs.
- Editing source Google Sheet structure/content.

## Public Interfaces and Type Changes

- No external API contract changes expected.
- Internal matcher functions in sync pipeline only.

## Implementation Steps

1. Audit current matcher behavior and identify false-positive path.
2. Patch matcher scoring/tokenization to require stronger evidence.
3. Run targeted checks (typecheck for changed code if feasible).
4. Trigger production dry-run sync and inspect warnings/outcomes.
5. Trigger production apply sync and verify D1 mappings.
6. Record unresolved stalls requiring manual/member-only mapping.

## Test Strategy

- Functional validation via production dry-run/apply sync summaries.
- D1 verification queries:
  - Missing URL count.
  - Known problematic stall link/title correctness.
- Optional local typecheck for touched files.

## Risk and Edge-Case Checklist

- Rows with title-only references (no URL).
- Members-only references not present in public API.
- Generic names that overlap cuisine keywords.
- Multi-address stalls sharing a single episode link.

## Approval Status

- Requested by agent on: 2026-02-23
- Approved by user: yes ("proceed"), 2026-02-23

## Beads Tracking

- Issue ID: sg-food-guide-jhl
- Current status: in_progress
- Last progress update: 2026-02-23

## Implementation Status

- Completed: matcher hardening to prevent weak token false positives and preserve unresolved member-only titles.
- Completed: added fallback channel-search lookup for unresolved non-member titles (bounded per run).
- Completed: deployed to production and executed apply sync (`stall-sync-93bb7499154782ce`).
- Validation:
  - Active stalls: 140
  - Missing YouTube URLs: 5
  - Non-member missing YouTube URLs: 0
  - Remaining unresolved are member-only references.
