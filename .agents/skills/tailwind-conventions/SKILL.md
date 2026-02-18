---
name: tailwind-conventions
description: |
  Project-specific Tailwind CSS conventions. Triggers on: styling, CSS, Tailwind classes, className,
  arbitrary values, h-[], w-[], spacing, and layout work.
  Load when writing or reviewing component styles.
---

# Tailwind Conventions

Strict rules for Tailwind CSS usage in this project.

## Hard Rules

- Never use Tailwind arbitrary values (`[value]`) in class names.
- Never use `px` units for spacing, sizing, or typography in inline styles. Use `rem`.
- Prefer Tailwind scale classes first. Use inline style only when the value is dynamic or not represented in the scale.
- Reuse shared components in `@admin/ui/components` before creating one-off markup.
- Use `cva` for variants, `cn()` from `@admin/ui/utils` for class merging, and `data-slot` for semantic styling hooks.

## Replacements

| Banned class   | Preferred replacement                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| `h-[100px]`    | `style={{ height: "6.25rem" }}`                                                          |
| `w-[200px]`    | `style={{ width: "12.5rem" }}`                                                           |
| `p-[15px]`     | Tailwind spacing class, or `style={{ padding: "0.9375rem" }}`                            |
| `text-[14px]`  | `text-sm`, or `style={{ fontSize: "0.875rem" }}`                                         |
| `gap-[10px]`   | `gap-2.5`, or `style={{ gap: "0.625rem" }}`                                              |
| `top-[50%]`    | `top-1/2`                                                                                |
| `bg-[#ff0000]` | Theme token/class, CSS variable, or `style={{ backgroundColor: "var(--color-danger)" }}` |

## Example

```tsx
// Bad
<div className="h-[100px] gap-[10px] text-[14px]" style={{ padding: "16px" }} />

// Good
<div className="gap-2.5 text-sm" style={{ height: "6.25rem", padding: "1rem" }} />
```

## Self-Check

Before submitting UI code:

- [ ] No `[value]` arbitrary syntax in class names
- [ ] No `px` values in inline style props for spacing/sizing/typography
- [ ] Tailwind scale used first where possible
- [ ] Shared UI primitives used where applicable
