---
name: react-state-management
description: State management and data flow best practices for React. This skill should be used when designing component architecture, deciding where state should live, or structuring state to avoid re-renders and bugs. Triggers on tasks involving useState, state lifting, component hierarchy design, or re-render optimization.
---

# React State Management

Guidelines for structuring and placing state in React applications to minimize re-renders and maximize maintainability.

## When to Apply

Reference these guidelines when:

- Deciding where state should live in component tree
- Structuring complex state objects
- Debugging unnecessary re-renders
- Designing new component hierarchies
- Refactoring existing state management

## Rule Categories by Priority

| Priority | Category            | Impact   | Prefix       |
| -------- | ------------------- | -------- | ------------ |
| 1        | State Placement     | CRITICAL | `placement-` |
| 2        | State Structure     | HIGH     | `structure-` |
| 3        | Effects & Data Flow | CRITICAL | `effects-`   |

## Quick Reference

### 1. State Placement (CRITICAL)

- `placement-leaf-rule` - Keep state in lowest component that needs it
- `placement-lift-only-when-shared` - Only lift state when multiple components need it

### 2. State Structure (HIGH)

- `structure-minimal` - Only store what cannot be derived
- `structure-avoid-contradictions` - Use discriminated unions over multiple booleans
- `structure-hoist-stable-values` - Hoist constants, pure functions, and static config outside components

### 3. Effects & Data Flow (CRITICAL)

- `effects-avoid-unnecessary` - Derive during render; handle user events in handlers, not Effects
- For React Query data transformation (`select` over `useMemo`), use the `react-query-data-patterns` skill.

## How to Use

Read individual rule files for detailed explanations and code examples:

```
rules/placement-leaf-rule.md
rules/structure-minimal.md
```

Each rule file contains:

- Brief explanation of why it matters
- Incorrect code example with explanation
- Correct code example with explanation
