import type { ReactNode, CSSProperties } from "react";

/**
 * Column definition for VirtualTable.
 * Compatible with TanStack Table's ColumnDef pattern.
 * @template T - The type of row data
 */
export type ColumnDef<T> = {
  /** Unique identifier for the column */
  id: string;
  /** Key to access the value from the row object */
  accessorKey?: keyof T;
  /** Function to compute the cell value from the row */
  accessorFn?: (row: T) => unknown;
  /** Column header - string or render function */
  header: string | ((props: { column: ColumnDef<T> }) => ReactNode);
  /** Custom cell renderer. If not provided, value is stringified. */
  cell?: (props: { row: T; rowIndex?: number; getValue: () => unknown }) => ReactNode;
  /** Column width in pixels. If not set, column will flex. */
  size?: number;
  /** Whether this column can be sorted */
  enableSorting?: boolean;
};

/**
 * Current sorting state for the table.
 * `null` means no sorting is applied.
 */
export type SortingState = {
  /** ID of the column being sorted */
  id: string;
  /** Whether sorting is descending */
  desc: boolean;
} | null;

/**
 * Unified handle for imperative control of VirtualTable.
 * Works with both container and window modes.
 */
export type VirtualTableHandle = {
  /** Current scroll offset in pixels */
  readonly scrollOffset: number;
  /** Total scrollable size in pixels */
  readonly scrollSize: number;
  /** Visible viewport size in pixels */
  readonly viewportSize: number;
  /** Scroll to absolute offset */
  scrollTo(offset: number): void;
  /** Scroll to specific row index */
  scrollToIndex(index: number, opts?: { align?: "start" | "center" | "end" | "nearest" }): void;
  /** Scroll by relative offset */
  scrollBy(offset: number): void;
};

/**
 * Base props shared by container and window modes.
 *
 * ## Performance: Stable Props Contract
 *
 * For optimal performance with large datasets, the following props should be
 * **referentially stable** (memoized or defined outside the component):
 *
 * - `columns` - Memoize with `useMemo`, dependencies: callbacks used in `cell`
 * - `getRowKey` - Define outside component or memoize with `useCallback`
 * - `onRowClick` - Memoize with `useCallback`
 * - `onSortingChange` - Memoize with `useCallback`
 * - `onEndReached` - Memoize with `useCallback`
 * - `renderExpandedRow` - Memoize with `useCallback`
 * - `emptyState` - Memoize with `useMemo`
 *
 * Rows are memoized internally and will skip re-render when their data object
 * reference is unchanged. React Query's structural sharing ensures existing
 * row objects maintain reference stability during pagination.
 *
 * @example
 * ```tsx
 * // ✅ Good - stable columns reference
 * const columns = useMemo(() => [...], [stableDeps]);
 *
 * // ✅ Good - stable callbacks
 * const handleRowClick = useCallback((row) => {...}, []);
 * const getRowKey = useCallback((row) => row.id, []);
 *
 * // ❌ Bad - new reference every render
 * <VirtualTable columns={[...]} onRowClick={(row) => {...}} />
 * ```
 *
 * @template T - The type of row data
 */
export type VirtualTableBaseProps<T> = {
  /**
   * Column definitions following TanStack Table pattern.
   * **Must be memoized** - unstable reference causes all rows to re-render.
   */
  columns: ColumnDef<T>[];
  /** Array of row data */
  data: T[];
  /**
   * Function to get a unique key for each row.
   * **Must be stable** - define outside component or wrap in `useCallback`.
   */
  getRowKey: (row: T) => string | number;
  /** Fixed height of each row in pixels */
  rowHeight: number;
  /** Current sorting state */
  sorting?: SortingState;
  /**
   * Callback fired when sorting changes (click on sortable header).
   * **Should be memoized** with `useCallback` for optimal performance.
   */
  onSortingChange?: (sorting: SortingState) => void;
  /**
   * Callback fired when scrolling approaches the end.
   * **Should be memoized** with `useCallback` for optimal performance.
   */
  onEndReached?: () => void;
  /**
   * Distance from end in pixels to trigger onEndReached.
   * Higher values trigger fetch earlier, reducing chance of seeing loading indicator.
   * @default 600
   */
  endReachedThreshold?: number;
  /** Whether more rows are currently being loaded (infinite scroll) */
  isLoadingMore?: boolean;
  /** Whether data is being refetched (shows loading bar and dims content) */
  isRefetching?: boolean;
  /**
   * Content to display when data array is empty.
   * **Should be memoized** with `useMemo` for optimal performance.
   */
  emptyState?: ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Inline styles for the container */
  style?: CSSProperties;
  /**
   * Callback fired when a row is clicked.
   * **Must be memoized** with `useCallback` for optimal performance.
   */
  onRowClick?: (row: T) => void;
  /** Set of expanded row keys (for expandable rows) */
  expandedRows?: Set<string | number>;
  /** Callback fired when expanded rows change */
  onExpandedRowsChange?: (expandedRows: Set<string | number>) => void;
  /**
   * Render function for expanded row content.
   * **Must be memoized** with `useCallback` for optimal performance.
   */
  renderExpandedRow?: (row: T) => ReactNode;
  /**
   * Number of rows visible without internal scrolling.
   * Sets table height = visibleRows × rowHeight + header height.
   * If this exceeds viewport, the page scrolls instead of the table.
   */
  visibleRows?: number;
};

/**
 * Props for the VirtualTable component.
 * @template T - The type of row data
 */
export type VirtualTableProps<T> = VirtualTableBaseProps<T> & {
  /**
   * Virtualization mode:
   * - "container" (default): Scrolls within a container element
   * - "window": Scrolls with the browser window (full-screen mobile)
   */
  mode?: "container" | "window";
  /** Offset from viewport top for sticky header (window mode only) */
  stickyHeaderOffset?: number;
  /** Bottom padding for fixed nav elements (window mode only) */
  bottomPadding?: number;
  /** Buffer size in pixels for pre-rendering items above/below viewport */
  bufferSize?: number;
  /** Horizontal padding for edge cells in window mode (default: 16) */
  horizontalPadding?: number;
  /**
   * Whether to show expand indicator column when expandedRows is provided.
   * The indicator is rendered as the last column automatically.
   * @default true (when expandedRows is provided)
   */
  showExpandIndicator?: boolean;
  /**
   * Maximum number of columns to render (window mode only).
   * Extra columns are truncated from the right, keeping the leftmost (highest priority) columns.
   * Useful for limiting visible columns on mobile where screen space is constrained.
   */
  maxColumns?: number;
};
