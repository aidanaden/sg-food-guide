# admin-ui Astro Port

This folder contains an Astro migration pass of components from:
`/Users/aidan/jupiter/admin/libs/ui/src/components`.

## Scope

- Every source `.tsx` component file was mirrored into an `.astro` file with matching relative paths.
- High-usage primitives and app-level pieces were implemented as native Astro components:
  - `ui/button.astro`, `ui/badge.astro`, `ui/card.astro`, `ui/input.astro`, `ui/checkbox.astro`
  - `ui/separator.astro`, `ui/skeleton.astro`, `ui/spinner.astro`, `ui/text-input.astro`
  - `ui/select.astro`, `ui/switch.astro`, `ui/accordion.astro`, `ui/collapsible.astro`
  - `ui/popover.astro`, `ui/dropdown-menu.astro`, `ui/tooltip/index.astro`
  - `ui/dialog/dialog-primitives.astro`, `ui/dialog/responsive-dialog.astro`, `ui/dialog/confirm-dialog.astro`
  - `ui/tabs/index.astro`, `ui/tabs/animated-tabs.astro`, `ui/drawer.astro`
  - `ui/sidebar.astro`, `ui/toast/index.astro`, `ui/toast/Toast.astro`, `sonner.astro`
  - `charts/*.astro`, `charts/adapters/*.astro`
  - `page-loading-bar/index.astro`, `page-loading-bar/loading-bar.astro`
  - `virtual-list/virtual-list.astro`, `virtual-list/sortable-virtual-list.astro`
  - `ui/virtual-table/virtual-table.astro` (plus container/window wrappers)
  - `empty-state.astro`, `loading-placeholder.astro`, `error-page.astro`, `external-link.astro`
  - `table-empty-state.astro`, `relative-age.astro`, `paste-address-button.astro`

## Notes

- These ports prioritize SSR-safe Astro compatibility over 1:1 React behavior.
- Components that depended on React context, hook state, or external client libraries need additional client-side work for full parity.
- Use `index.ts` for curated imports, or import any component directly by path.
