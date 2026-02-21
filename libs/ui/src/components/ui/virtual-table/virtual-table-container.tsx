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
} from "react";
import { VList, type VListHandle } from "virtua";

import { cn } from "../../../utils";
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

/** Props for memoized table cell */
type TableCellProps<T> = {
  row: T;
  rowIndex: number;
  column: ColumnDef<T>;
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
const TableCellInner = <T,>({ row, rowIndex, column }: TableCellProps<T>) => {
  const value = getCellValue(row, column);
  const cellContent = column.cell
    ? column.cell({ row, rowIndex, getValue: () => value })
    : value != null
      ? stringifyCellValue(value)
      : "";

  return <div className="overflow-hidden px-3 text-sm text-ellipsis">{cellContent}</div>;
};

const TableCell = memo(TableCellInner) as <T>(props: TableCellProps<T>) => ReactElement;

/** Props for memoized table row */
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
  const rowStyle = { gridTemplateColumns, height: rowHeight };
  const rowCells = (
    <>
      {columns.map((column) => (
        <TableCell key={column.id} row={row} rowIndex={rowIndex} column={column} />
      ))}
      {shouldShowExpandIndicator && (
        <div className="flex items-center justify-center px-1">
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
    prevProps.renderExpandedRow === nextProps.renderExpandedRow
  );
}) as <T>(props: TableRowProps<T>) => ReactElement;

type VirtualTableContainerHeaderProps<T> = {
  columns: ColumnDef<T>[];
  gridTemplateColumns: string;
  sorting: VirtualTableBaseProps<T>["sorting"];
  shouldShowExpandIndicator: boolean;
  isRefetching: boolean;
  onHeaderClick: (column: ColumnDef<T>) => void;
};

function getColumnAriaSortValue<T>(
  column: ColumnDef<T>,
  sorting: VirtualTableBaseProps<T>["sorting"],
): "ascending" | "descending" | "none" | undefined {
  if (column.enableSorting !== true) return undefined;
  if (sorting?.id !== column.id) return "none";
  return sorting.desc ? "descending" : "ascending";
}

const VirtualTableContainerHeaderInner = <T,>({
  columns,
  gridTemplateColumns,
  sorting,
  shouldShowExpandIndicator,
  isRefetching,
  onHeaderClick,
}: VirtualTableContainerHeaderProps<T>) => (
  <div className="bg-surface grid w-full shrink-0 border-b" style={{ gridTemplateColumns }}>
    {columns.map((column, index) => {
      const isSorted = sorting?.id === column.id;
      const isSortedDesc = isSorted && sorting?.desc;
      const isLastColumn = index === columns.length - 1 && !shouldShowExpandIndicator;
      const headerClassName =
        "text-foreground-muted overflow-hidden px-3 py-1 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5";

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
            aria-sort={getColumnAriaSortValue(column, sorting)}
            className={cn(
              headerClassName,
              "hover:text-foreground focus-visible:ring-ring cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            )}
            onClick={() => onHeaderClick(column)}
          >
            {content}
          </button>
        );
      }

      return (
        <div key={column.id} className={headerClassName}>
          {content}
        </div>
      );
    })}
    {shouldShowExpandIndicator && (
      <div className="text-foreground-muted px-3 py-1 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5">
        {isRefetching && <Spinner size="xs" />}
      </div>
    )}
  </div>
);

const VirtualTableContainerHeader = memo(VirtualTableContainerHeaderInner) as <T>(
  props: VirtualTableContainerHeaderProps<T>,
) => ReactElement;

// ============================================================================
// Main Component
// ============================================================================

/** Header height in pixels (py-3 padding + text-xs line height) */
const HEADER_HEIGHT = 40;

type VirtualTableContainerProps<T> = VirtualTableBaseProps<T> & {
  /** Whether to show expand indicator column when expandedRows is provided */
  showExpandIndicator?: boolean;
};

function VirtualTableContainerInner<T>(
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
    onExpandedRowsChange: _onExpandedRowsChange,
    renderExpandedRow,
    visibleRows,
    showExpandIndicator,
  }: VirtualTableContainerProps<T>,
  ref: ForwardedRef<VirtualTableHandle>,
) {
  // Internal ref to the VList component for scroll detection and imperative control
  const listRef = useRef<VListHandle>(null);
  const isExpandable = !!renderExpandedRow;

  // Expose a clean VirtualTableHandle to parent components via ref.
  // We use useImperativeHandle because:
  // 1. We need listRef internally for proactive scroll detection (handleScroll)
  // 2. Parent components expect VirtualTableHandle interface, not raw VListHandle
  // 3. This creates an adapter layer that delegates to listRef while hiding implementation details
  useImperativeHandle(
    ref,
    () => ({
      get scrollOffset() {
        return listRef.current?.scrollOffset ?? 0;
      },
      get scrollSize() {
        return listRef.current?.scrollSize ?? 0;
      },
      get viewportSize() {
        return listRef.current?.viewportSize ?? 0;
      },
      scrollTo(offset: number) {
        listRef.current?.scrollTo(offset);
      },
      scrollToIndex(index: number, opts?: { align?: "start" | "center" | "end" | "nearest" }) {
        listRef.current?.scrollToIndex(index, opts);
      },
      scrollBy(offset: number) {
        listRef.current?.scrollBy(offset);
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
  const handleScroll = useCallback(
    (offset: number) => {
      if (!onEndReached || isLoadingMore) return;

      const handle = listRef.current;
      if (!handle) return;

      const distanceFromEnd = handle.scrollSize - offset - handle.viewportSize;
      if (distanceFromEnd < endReachedThreshold) {
        onEndReached();
      }
    },
    [onEndReached, isLoadingMore, endReachedThreshold],
  );

  // When content doesn't fill the viewport, no scroll event fires so onEndReached
  // is never called. Uses pure math (data count × row height vs container height)
  // instead of virtua's handle measurements, which aren't reliable until after
  // virtua's internal ResizeObserver cycle completes.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onEndReached || isLoadingMore || data.length === 0) return;

    const el = containerRef.current;
    if (!el) return;

    const availableHeight = el.clientHeight - HEADER_HEIGHT;
    const contentHeight = data.length * rowHeight;

    if (contentHeight < availableHeight + endReachedThreshold) {
      onEndReached();
    }
  }, [data.length, onEndReached, isLoadingMore, rowHeight, endReachedThreshold]);

  // Fallback for edge cases (e.g., user jumps directly to end)
  const handleScrollEnd = useCallback(() => {
    if (!onEndReached || isLoadingMore) return;

    const handle = listRef.current;
    if (!handle) return;

    const distanceFromEnd = handle.scrollSize - handle.scrollOffset - handle.viewportSize;
    if (distanceFromEnd < endReachedThreshold) {
      onEndReached();
    }
  }, [onEndReached, isLoadingMore, endReachedThreshold]);

  // Determine if expand indicator should be shown
  // Default to true when expandedRows is provided, unless explicitly set to false
  const shouldShowExpandIndicator = showExpandIndicator ?? !!expandedRows;

  // Build grid template for columns
  // Use minmax(0, 1fr) for flex columns to allow shrinking
  const gridTemplateColumns = useMemo(() => {
    const colTemplates = columns.map((col) =>
      col.size != null ? `${col.size}px` : "minmax(0, 1fr)",
    );
    if (shouldShowExpandIndicator) {
      colTemplates.push(`${EXPAND_COLUMN_WIDTH}px`);
    }
    return colTemplates.join(" ");
  }, [columns, shouldShowExpandIndicator]);

  // Compute container style with visibleRows height if specified
  const containerStyle =
    visibleRows != null ? { ...style, height: visibleRows * rowHeight + HEADER_HEIGHT } : style;

  // Memoize row elements to maintain stable references for virtua's internal caching.
  // Per virtua docs: "new React element instances can disrupt internal memoization"
  // This ensures VList can efficiently diff and reuse elements across renders.
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
            columns={columns}
            gridTemplateColumns={gridTemplateColumns}
            rowHeight={rowHeight}
            isExpanded={isExpanded}
            isExpandable={isExpandable}
            shouldShowExpandIndicator={shouldShowExpandIndicator}
            onRowClick={onRowClick}
            renderExpandedRow={renderExpandedRow}
          />
        );
      }),
    [
      data,
      getRowKey,
      expandedRows,
      columns,
      gridTemplateColumns,
      rowHeight,
      isExpandable,
      shouldShowExpandIndicator,
      onRowClick,
      renderExpandedRow,
      ],
  );

  if (data.length === 0 && emptyState != null) {
    return (
      <div
        ref={containerRef}
        className={cn("flex w-full max-w-full flex-col overflow-hidden", className)}
        style={containerStyle}
      >
        <VirtualTableContainerHeader
          columns={columns}
          gridTemplateColumns={gridTemplateColumns}
          sorting={sorting}
          shouldShowExpandIndicator={shouldShowExpandIndicator}
          isRefetching={isRefetching}
          onHeaderClick={handleHeaderClick}
        />
        {/* Empty state */}
        <div className="flex-1">{emptyState}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("flex w-full max-w-full flex-col overflow-hidden", className)}
      style={containerStyle}
    >
      <VirtualTableContainerHeader
        columns={columns}
        gridTemplateColumns={gridTemplateColumns}
        sorting={sorting}
        shouldShowExpandIndicator={shouldShowExpandIndicator}
        isRefetching={isRefetching}
        onHeaderClick={handleHeaderClick}
      />

      {/* Virtualized rows - memoize elements for stable references per virtua docs */}
      <VList
        ref={listRef}
        className={cn(
          "flex-1 overflow-auto transition duration-200",
          isRefetching && "pointer-events-none opacity-50",
        )}
        style={{
          filter: isRefetching ? "blur(0.0625rem)" : undefined, // 1px in rem (no Tailwind arbitrary values)
        }}
        onScroll={handleScroll}
        onScrollEnd={handleScrollEnd}
      >
        {rowElements}
        {isLoadingMore && (
          <div
            className="text-foreground-muted flex items-center justify-center gap-2 text-sm"
            style={{ height: rowHeight }}
          >
            <Spinner size="sm" />
            <span>Loading...</span>
          </div>
        )}
      </VList>
    </div>
  );
}

/**
 * Container-based virtual table using VList from virtua.
 * Scrolls within its container element.
 */
const VirtualTableContainer = forwardRef(VirtualTableContainerInner) as <T>(
  props: VirtualTableContainerProps<T> & {
    ref?: ForwardedRef<VirtualTableHandle>;
  },
) => ReactElement;

export { VirtualTableContainer };
