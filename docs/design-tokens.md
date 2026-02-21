# Design Tokens

This project uses a shared, dark-first design-token system defined in:

- `libs/ui/global.css`

## Architecture

The token stack is layered:

1. Base scale (`--base-*`) in OKLCH.
2. Primitive tokens (`--gray-*`, `--flame-*`, `--jade-*`, `--gold-*`).
3. Semantic tokens (`--background`, `--foreground`, `--primary`, `--success`, etc).
4. Tailwind exports in `@theme` (`--color-*`).

Use semantic tokens first in UI code. Use primitives only when a semantic token does not fit.

## Source Of Truth

All shared color, type, radius, and layout tokens are centralized in:

- `libs/ui/global.css`

`apps/web/src/styles/global.css` should only contain app-local styles that are not shared tokens.

## Dark-Only Theme

The app is dark-only by default. Root document class should include:

- `dark`
- `bg-background`
- `text-foreground`

## Token Categories

Use these semantic categories in class names:

- Surfaces: `bg-background`, `bg-surface`, `bg-surface-raised`, `bg-muted`
- Text: `text-foreground`, `text-foreground-muted`, `text-foreground-subtle`
- Borders/rings: `border-border`, `border-border-input`, `ring-ring`
- Brand/action: `bg-primary`, `text-primary-foreground`, `border-primary`
- Status: `success`, `warning`, `destructive`, `info` families

## Opacity Policy

Color opacity utilities are disallowed in component styles except:

- `bg-black/*` on dialog and drawer overlays
- `shadow-*/*` utilities for shadows

Guardrail script:

- `scripts/check-color-opacity.ts`

Run with:

```bash
bun ./scripts/check-color-opacity.ts
```

## Migration Guidance

When editing components:

1. Prefer semantic classes over primitive classes.
2. Avoid direct hex/OKLCH literals in component class names.
3. Avoid arbitrary Tailwind values for color classes.
4. Keep overlay behavior in shared primitives (`Dialog`/`Drawer`) instead of feature components.

## Verification

Recommended checks after token changes:

```bash
bun ./scripts/check-color-opacity.ts
bun --filter @sg-food-guide/ui lint:check
bun --filter @sg-food-guide/ui typecheck
bun --filter @sg-food-guide/web check
```
