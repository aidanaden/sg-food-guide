import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useImperativeHandle,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type CSSProperties,
} from "react";
import { WindowVirtualizer, type WindowVirtualizerHandle } from "virtua";

import { cn, getPagePadding } from "../../../utils";
import { Collapsible } from "../collapsible";
import { Spinner } from "../spinner";
import type { VirtualTableBaseProps, VirtualTableHandle, ColumnDef } from "./types";
import { getCellValue } from "./utils";

/** Width of the expand indicator column in pixels */
const EXPAND_COLUMN_WIDTH = 32;

/** Memoized expand indicator to prevent re-renders of other rows when one expands */
const ExpandIndicator = memo(({ expanded }: { expanded: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "iconify ph--caret-down text-foreground-subtle size-4 transition-transform duration-200",
      expanded && "rotate-180",
    )}
  />
));

// ============================================================================
// Memoized Cell and Row Components
// ============================================================================

/** Props for memoized table cell (window variant with edge padding) */
type TableCellProps<T> = {
  row: T;
  rowIndex: number;
  column: ColumnDef<T>;
  edgePadding?: CSSProperties;
};

function stringifyCellValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return `${value}`;
  }
  return "";
}

/**
 * Memoized table cell to prevent re-renders when sibling cells change.
 * Only re-renders when row data or column definition changes.
 */
const TableCellInner = <T,>({ row, rowIndex, column, edgePadding }: TableCellProps<T>) => {
  const value = getCellValue(row, column);
  const cellContent = column.cell
    ? column.cell({ row, rowIndex, getValue: () => value })
    : value != null
      ? stringifyCellValue(value)
      : "";

  return (
    <div className="overflow-hidden px-3 text-sm text-ellipsis" style={edgePadding}>
      {cellContent}
    </div>
  );
};

const TableCell = memo(TableCellInner) as <T>(props: TableCellProps<T>) => ReactElement;

/** Props for memoized table row (window variant) */
type TableRowProps<T> = {
  row: T;
  rowIndex: number;
  columns: ColumnDef<T>[];
  gridTemplateColumns: string;
  rowHeight: number;
  isExpanded: boolean;
  isExpandable: boolean;
  shouldShowExpandIndicator: boolean;
  onRowClick?: (row: T) => void;
  renderExpandedRow?: (row: T) => ReactNode;
  /** Function to get edge padding for a column index */
  getEdgePadding: (index: number) => CSSProperties | undefined;
  /** Total column count including expand indicator */
  totalColumnCount: number;
};

/**
 * Memoized table row to prevent re-renders when data array changes
 * but this specific row's data hasn't changed.
 *
 * Relies on React Query's structural sharing to maintain stable
 * row object references during pagination.
 */
const TableRowInner = <T,>({
  row,
  rowIndex,
  columns,
  gridTemplateColumns,
  rowHeight,
  isExpanded,
  isExpandable,
  shouldShowExpandIndicator,
  onRowClick,
  renderExpandedRow,
  getEdgePadding,
  totalColumnCount,
}: TableRowProps<T>) => {
  const handleRowClick = useCallback(() => {
    onRowClick?.(row);
  }, [onRowClick, row]);

  const handleRowKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (onRowClick == null) {
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowClick();
      }
    },
    [onRowClick, handleRowClick],
  );

  const expandedRowContent = useMemo(
    () => (isExpandable && renderExpandedRow ? renderExpandedRow(row) : null),
    [isExpandable, renderExpandedRow, row],
  );

  const rowClassName = cn(
    "hover:bg-muted/30 grid w-full items-center transition-colors",
    (onRowClick != null || isExpandable) && "cursor-pointer",
    isExpanded && "bg-muted/20",
  );
  const rowStyle = { gridTemplateColumns, minHeight: rowHeight };
  const rowCells = (
    <>
      {columns.map((column, index) => (
        <TableCell
          key={column.id}
          row={row}
          rowIndex={rowIndex}
          column={column}
          edgePadding={getEdgePadding(index)}
        />
      ))}
      {shouldShowExpandIndicator && (
        <div
          className="flex items-center justify-center px-1"
          style={getEdgePadding(totalColumnCount - 1)}
        >
          <ExpandIndicator expanded={isExpanded} />
        </div>
      )}
    </>
  );

  return (
    <div className="border-border w-full border-b">
      {onRowClick ? (
        <div
          className={rowClassName}
          role="button"
          tabIndex={0}
          style={rowStyle}
          onClick={handleRowClick}
          onKeyDown={handleRowKeyDown}
        >
          {rowCells}
        </div>
      ) : (
        <div className={rowClassName} style={rowStyle}>
          {rowCells}
        </div>
      )}
      {expandedRowContent != null && <Collapsible open={isExpanded}>{expandedRowContent}</Collapsible>}
    </div>
  );
};

const TableRow = memo(TableRowInner, (prevProps, nextProps) => {
  // Custom comparison - only re-render if meaningful props changed
  // Row object reference stability is key - React Query's structural sharing ensures this
  return (
    prevProps.row === nextProps.row &&
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.columns === nextProps.columns &&
    prevProps.gridTemplateColumns === nextProps.gridTemplateColumns &&
    prevProps.rowHeight === nextProps.rowHeight &&
    prevProps.onRowClick === nextProps.onRowClick &&
    prevProps.renderExpandedRow === nextProps.renderExpandedRow &&
    prevProps.getEdgePadding === nextProps.getEdgePadding
  );
}) as <T>(props: TableRowProps<T>) => ReactElement;

type VirtualTableWindowHeaderProps<T> = {
  stickyHeaderOffset: number;
  gridTemplateColumns: string;
  columns: ColumnDef<T>[];
  sorting: VirtualTableBaseProps<T>["sorting"];
  shouldShowExpandIndicator: boolean;
  isRefetching: boolean;
  getEdgePadding: (index: number) => CSSProperties | undefined;
  columnCount: number;
  onHeaderClick: (column: ColumnDef<T>) => void;
};

function getWindowColumnAriaSortValue<T>(
  column: ColumnDef<T>,
  sorting: VirtualTableBaseProps<T>["sorting"],
): "ascending" | "descending" | "none" | undefined {
  if (column.enableSorting !== true) return undefined;
  if (sorting?.id !== column.id) return "none";
  return sorting.desc ? "descending" : "ascending";
}

const VirtualTableWindowHeaderInner = <T,>({
  stickyHeaderOffset,
  gridTemplateColumns,
  columns,
  sorting,
  shouldShowExpandIndicator,
  isRefetching,
  getEdgePadding,
  columnCount,
  onHeaderClick,
}: VirtualTableWindowHeaderProps<T>) => (
  <div
    className="bg-surface sticky z-10 grid w-full shrink-0 border-b"
    style={{ top: stickyHeaderOffset, gridTemplateColumns }}
  >
    {columns.map((column, index) => {
      const isSorted = sorting?.id === column.id;
      const isSortedDesc = isSorted && sorting?.desc;
      const isLastColumn = index === columns.length - 1 && !shouldShowExpandIndicator;
      const headerClassName =
        "text-foreground-muted overflow-hidden px-3 py-2 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5";
      const cellStyle = getEdgePadding(index);

      const content = (
        <div className="flex items-center gap-1 whitespace-nowrap">
          {isLastColumn && isRefetching ? (
            <Spinner size="xs" />
          ) : (
            <>
              {typeof column.header === "function" ? column.header({ column }) : column.header}
              {column.enableSorting === true && (
                <span
                  className={cn(
                    "iconify size-3.5 shrink-0",
                    isSorted
                      ? isSortedDesc
                        ? "ph--caret-down-fill"
                        : "ph--caret-up-fill"
                      : "ph--caret-up-down opacity-30",
                  )}
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>
      );

      if (column.enableSorting === true) {
        return (
          <button
            key={column.id}
            type="button"
            aria-sort={getWindowColumnAriaSortValue(column, sorting)}
            className={cn(
              headerClassName,
              "hover:text-foreground focus-visible:ring-ring cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            )}
            style={cellStyle}
            onClick={() => onHeaderClick(column)}
          >
            {content}
          </button>
        );
      }

      return (
        <div key={column.id} className={headerClassName} style={cellStyle}>
          {content}
        </div>
      );
    })}
    {shouldShowExpandIndicator && (
      <div
        className="text-foreground-muted px-3 py-2 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5"
        style={getEdgePadding(columnCount)}
      >
        {isRefetching && <Spinner size="xs" />}
      </div>
    )}
  </div>
);

const VirtualTableWindowHeader = memo(VirtualTableWindowHeaderInner) as <T>(
  props: VirtualTableWindowHeaderProps<T>,
) => ReactElement;

// ============================================================================
// Main Component
// ============================================================================

type VirtualTableWindowProps<T> = VirtualTableBaseProps<T> & {
  /** Offset from viewport top for sticky header */
  stickyHeaderOffset?: number;
  /** Bottom padding for fixed nav elements */
  bottomPadding?: number;
  /** Buffer size in pixels for pre-rendering items */
  bufferSize?: number;
  /** Horizontal padding for edge cells (matches container padding for full-bleed) */
  horizontalPadding?: number;
  /** Whether to show expand indicator column when expandedRows is provided */
  showExpandIndicator?: boolean;
  /** Maximum number of columns to render. Extra columns are truncated from the right. */
  maxColumns?: number;
};

function VirtualTableWindowInner<T>(
  {
    columns,
    data,
    getRowKey,
    rowHeight,
    sorting,
    onSortingChange,
    onEndReached,
    endReachedThreshold = 600,
    isLoadingMore = false,
    isRefetching = false,
    emptyState,
    className,
    style,
    onRowClick,
    expandedRows,
    renderExpandedRow,
    stickyHeaderOffset = 0,
    bottomPadding = 0,
    bufferSize,
    horizontalPadding,
    showExpandIndicator,
    maxColumns,
  }: VirtualTableWindowProps<T>,
  ref: ForwardedRef<VirtualTableHandle>,
) {
  // Internal ref for scroll detection and imperative control
  const windowRef = useRef<WindowVirtualizerHandle>(null);
  const isExpandable = !!renderExpandedRow;

  // Truncate columns to maxColumns if specified (mobile column limiting)
  const resolvedColumns = maxColumns != null ? columns.slice(0, maxColumns) : columns;
  const columnCount = resolvedColumns.length;

  // Resolve horizontal padding - defaults to CSS variable value for consistency with page layout
  const resolvedHorizontalPadding = horizontalPadding ?? getPagePadding();

  // Expose a clean VirtualTableHandle to parent components via ref.
  // We use useImperativeHandle because:
  // 1. We need windowRef internally for proactive scroll detection (handleScroll)
  // 2. Parent components expect VirtualTableHandle interface, not raw WindowVirtualizerHandle
  // 3. WindowVirtualizerHandle has fewer methods, so we polyfill some via window/document APIs
  useImperativeHandle(
    ref,
    () => ({
      get scrollOffset() {
        return windowRef.current?.scrollOffset ?? 0;
      },
      get scrollSize() {
        // WindowVirtualizerHandle doesn't have scrollSize, use document
        if (typeof document !== "undefined") {
          return document.documentElement.scrollHeight;
        }
        return 0;
      },
      get viewportSize() {
        return windowRef.current?.viewportSize ?? 0;
      },
      scrollTo(offset: number) {
        // WindowVirtualizerHandle doesn't have scrollTo, use window
        if (typeof window !== "undefined") {
          window.scrollTo({ top: offset });
        }
      },
      scrollToIndex(index: number, opts?: { align?: "start" | "center" | "end" | "nearest" }) {
        windowRef.current?.scrollToIndex(index, opts);
      },
      scrollBy(offset: number) {
        // WindowVirtualizerHandle doesn't have scrollBy, use window
        if (typeof window !== "undefined") {
          window.scrollBy({ top: offset });
        }
      },
    }),
    [],
  );

  const handleHeaderClick = useCallback(
    (column: ColumnDef<T>) => {
      if (column.enableSorting !== true || onSortingChange == null) return;

      if (sorting?.id === column.id) {
        if (sorting.desc) {
          // desc -> null (remove sort)
          onSortingChange(null);
        } else {
          // asc -> desc
          onSortingChange({ id: column.id, desc: true });
        }
      } else {
        // new column -> asc
        onSortingChange({ id: column.id, desc: false });
      }
    },
    [sorting, onSortingChange],
  );

  // Proactive scroll detection - triggers DURING scroll before reaching end
  const handleScroll = useCallback(() => {
    if (!onEndReached || isLoadingMore) return;

    const handle = windowRef.current;
    if (!handle || typeof document === "undefined") return;

    const scrollSize = document.documentElement.scrollHeight;
    const distanceFromEnd = scrollSize - handle.scrollOffset - handle.viewportSize;
    if (distanceFromEnd < endReachedThreshold) {
      onEndReached();
    }
  }, [onEndReached, isLoadingMore, endReachedThreshold]);

  // When content doesn't fill the viewport, no scroll event fires so onEndReached
  // is never called. Uses pure math (data count × row height vs window height)
  // instead of virtua's handle measurements, which aren't reliable until after
  // virtua's internal ResizeObserver cycle completes.
  useEffect(() => {
    if (!onEndReached || isLoadingMore || data.length === 0) return;
    if (typeof window === "undefined") return;

    const contentHeight = data.length * rowHeight;

    // Conservative: if rows can't fill the entire window, they definitely
    // can't fill the available table area (which is smaller due to page header/toolbar)
    if (contentHeight < window.innerHeight + endReachedThreshold) {
      onEndReached();
    }
  }, [data.length, onEndReached, isLoadingMore, rowHeight, endReachedThreshold]);

  // Fallback for edge cases (e.g., user jumps directly to end)
  const handleScrollEnd = useCallback(() => {
    if (!onEndReached || isLoadingMore) return;

    const handle = windowRef.current;
    if (handle && typeof document !== "undefined") {
      const { scrollOffset, viewportSize } = handle;
      const scrollSize = document.documentElement.scrollHeight;
      const distanceFromEnd = scrollSize - (scrollOffset + viewportSize);
      if (distanceFromEnd < endReachedThreshold) {
        onEndReached();
      }
    }
  }, [onEndReached, isLoadingMore, endReachedThreshold]);

  // Determine if expand indicator should be shown
  // Default to true when expandedRows is provided, unless explicitly set to false
  const shouldShowExpandIndicator = showExpandIndicator ?? !!expandedRows;

  // Build grid template for columns
  const gridTemplateColumns = useMemo(() => {
    const colTemplates = resolvedColumns.map((col) =>
      col.size != null ? `${col.size}px` : "minmax(0, 1fr)",
    );
    if (shouldShowExpandIndicator) {
      colTemplates.push(`${EXPAND_COLUMN_WIDTH}px`);
    }
    return colTemplates.join(" ");
  }, [resolvedColumns, shouldShowExpandIndicator]);

  // Total column count including expand indicator
  const totalColumnCount = shouldShowExpandIndicator ? columnCount + 1 : columnCount;

  // Get extra padding style for first/last columns (for edge-to-edge effect)
  // Memoized to maintain stable reference for TableRow memoization
  const getEdgePadding = useCallback(
    (index: number): CSSProperties | undefined => {
      if (index === 0) return { paddingLeft: resolvedHorizontalPadding };
      if (index === totalColumnCount - 1) return { paddingRight: resolvedHorizontalPadding };
      return undefined;
    },
    [resolvedHorizontalPadding, totalColumnCount],
  );

  // Memoize row elements to maintain stable references for virtua's internal caching.
  // Per virtua docs: "new React element instances can disrupt internal memoization"
  // This ensures WindowVirtualizer can efficiently diff and reuse elements across renders.
  const rowElements = useMemo(
    () =>
      data.map((row, rowIndex) => {
        const rowKey = getRowKey(row);
        const isExpanded = expandedRows?.has(rowKey) ?? false;

        return (
          <TableRow
            key={rowKey}
            row={row}
            rowIndex={rowIndex}
            columns={resolvedColumns}
            gridTemplateColumns={gridTemplateColumns}
            rowHeight={rowHeight}
            isExpanded={isExpanded}
            isExpandable={isExpandable}
            shouldShowExpandIndicator={shouldShowExpandIndicator}
            onRowClick={onRowClick}
            renderExpandedRow={renderExpandedRow}
            getEdgePadding={getEdgePadding}
            totalColumnCount={totalColumnCount}
          />
        );
      }),
    [
      data,
      getRowKey,
      expandedRows,
      resolvedColumns,
      gridTemplateColumns,
      rowHeight,
      isExpandable,
      shouldShowExpandIndicator,
      onRowClick,
      renderExpandedRow,
      getEdgePadding,
      totalColumnCount,
    ],
  );

  if (data.length === 0 && emptyState != null) {
    return (
      <div className={cn("flex w-full flex-col", className)} style={style}>
        <VirtualTableWindowHeader
          stickyHeaderOffset={stickyHeaderOffset}
          gridTemplateColumns={gridTemplateColumns}
          columns={resolvedColumns}
          sorting={sorting}
          shouldShowExpandIndicator={shouldShowExpandIndicator}
          isRefetching={isRefetching}
          getEdgePadding={getEdgePadding}
          columnCount={columnCount}
          onHeaderClick={handleHeaderClick}
        />
        <div className="flex-1">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full flex-col", className)} style={style}>
      <VirtualTableWindowHeader
        stickyHeaderOffset={stickyHeaderOffset}
        gridTemplateColumns={gridTemplateColumns}
        columns={resolvedColumns}
        sorting={sorting}
        shouldShowExpandIndicator={shouldShowExpandIndicator}
        isRefetching={isRefetching}
        getEdgePadding={getEdgePadding}
        columnCount={columnCount}
        onHeaderClick={handleHeaderClick}
      />

      {/* Window-virtualized rows - dimmed when refetching */}
      <div
        className={cn("transition duration-200", isRefetching && "pointer-events-none opacity-50")}
        style={{
          filter: isRefetching ? "blur(0.0625rem)" : undefined, // 1px in rem (no Tailwind arbitrary values)
        }}
      >
        <WindowVirtualizer
          ref={windowRef}
          onScroll={handleScroll}
          onScrollEnd={handleScrollEnd}
          bufferSize={bufferSize}
        >
          {rowElements}

          {/* Loading indicator */}
          {isLoadingMore && (
            <div
              className="text-foreground-muted flex items-center justify-center gap-2 text-sm"
              style={{ height: rowHeight }}
            >
              <Spinner size="sm" />
              <span>Loading...</span>
            </div>
          )}

          {/* Bottom padding spacer for fixed nav */}
          {bottomPadding > 0 && <div aria-hidden="true" style={{ height: bottomPadding }} />}
        </WindowVirtualizer>
      </div>
    </div>
  );
}

/**
 * Window-based virtual table using WindowVirtualizer from virtua.
 * Scrolls with the browser window for full-screen mobile experience.
 * Features:
 * - CSS sticky header
 * - Edge-to-edge design (no border/rounded corners)
 * - Bottom padding support for fixed nav elements
 */
const VirtualTableWindow = forwardRef(VirtualTableWindowInner) as <T>(
  props: VirtualTableWindowProps<T> & {
    ref?: ForwardedRef<VirtualTableHandle>;
  },
) => ReactElement;

export { VirtualTableWindow };
