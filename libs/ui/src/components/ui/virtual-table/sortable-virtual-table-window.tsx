import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Result } from "better-result";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ForwardedRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { WindowVirtualizer, type WindowVirtualizerHandle } from "virtua";

import { cn, getPagePadding } from "../../../utils";
import { getReorderIndices } from "../../sortable/reorder";
import { Button } from "../button";
import { Collapsible } from "../collapsible";
import { Spinner } from "../spinner";
import type { ColumnDef, VirtualTableBaseProps, VirtualTableHandle } from "./types";
import { getCellValue } from "./utils";

/** Width of the reorder drag handle column in pixels */
const REORDER_COLUMN_WIDTH = 40;

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

type TableRowProps<T> = {
  row: T;
  rowKey: string | number;
  rowIndex: number;
  columns: ColumnDef<T>[];
  gridTemplateColumns: string;
  rowHeight: number;
  isExpanded: boolean;
  isExpandable: boolean;
  shouldShowExpandIndicator: boolean;
  onRowClick?: (row: T) => void;
  renderExpandedRow?: (row: T) => ReactNode;
  getEdgePadding: (index: number) => CSSProperties | undefined;
  totalColumnCount: number;
  getDragHandleLabel?: (row: T) => string;
};

const TableRowInner = <T,>({
  row,
  rowKey,
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
  getDragHandleLabel,
}: TableRowProps<T>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rowKey,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleLabel = getDragHandleLabel?.(row) ?? "Drag to reorder";
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
    "hover:bg-muted-hover grid w-full items-center transition-colors",
    (onRowClick != null || isExpandable) && "cursor-pointer",
    isExpanded && "bg-muted",
    isDragging && "opacity-50",
  );
  const rowStyle = { gridTemplateColumns, minHeight: rowHeight };
  const rowCells = (
    <>
      <div className="flex items-center justify-center px-1" style={getEdgePadding(0)}>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={handleLabel}
          className="text-foreground-subtle hover:text-foreground size-auto min-h-0 min-w-0 cursor-grab touch-none rounded border-0 bg-transparent p-1 hover:bg-transparent"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true" className="iconify ph--dots-six-vertical size-4" />
        </Button>
      </div>

      {columns.map((column, index) => (
        <TableCell
          key={column.id}
          row={row}
          rowIndex={rowIndex}
          column={column}
          edgePadding={getEdgePadding(index + 1)}
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
    <div ref={setNodeRef} style={style} className="border-border w-full border-b">
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
  return (
    prevProps.row === nextProps.row &&
    prevProps.rowIndex === nextProps.rowIndex &&
    prevProps.rowKey === nextProps.rowKey &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.columns === nextProps.columns &&
    prevProps.gridTemplateColumns === nextProps.gridTemplateColumns &&
    prevProps.rowHeight === nextProps.rowHeight &&
    prevProps.onRowClick === nextProps.onRowClick &&
    prevProps.renderExpandedRow === nextProps.renderExpandedRow &&
    prevProps.getEdgePadding === nextProps.getEdgePadding &&
    prevProps.getDragHandleLabel === nextProps.getDragHandleLabel
  );
}) as <T>(props: TableRowProps<T>) => ReactElement;

type SortableVirtualTableWindowHeaderProps<T> = {
  stickyHeaderOffset: number;
  gridTemplateColumns: string;
  columns: ColumnDef<T>[];
  shouldShowExpandIndicator: boolean;
  isRefetching: boolean;
  getEdgePadding: (index: number) => CSSProperties | undefined;
  totalColumnCount: number;
};

const SortableVirtualTableWindowHeaderInner = <T,>({
  stickyHeaderOffset,
  gridTemplateColumns,
  columns,
  shouldShowExpandIndicator,
  isRefetching,
  getEdgePadding,
  totalColumnCount,
}: SortableVirtualTableWindowHeaderProps<T>) => (
  <div
    className="bg-surface sticky z-10 grid w-full shrink-0 border-b"
    style={{ top: stickyHeaderOffset, gridTemplateColumns }}
  >
    <div
      className="text-foreground-muted overflow-hidden px-3 py-2 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5"
      style={getEdgePadding(0)}
    />
    {columns.map((column, index) => {
      const isLastColumn = index === columns.length - 1 && !shouldShowExpandIndicator;
      return (
        <div
          key={column.id}
          className="text-foreground-muted overflow-hidden px-3 py-2 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5"
          style={getEdgePadding(index + 1)}
        >
          <div className="flex items-center gap-1 whitespace-nowrap">
            {isLastColumn && isRefetching ? (
              <Spinner size="xs" />
            ) : typeof column.header === "function" ? (
              column.header({ column })
            ) : (
              column.header
            )}
          </div>
        </div>
      );
    })}
    {shouldShowExpandIndicator && (
      <div
        className="text-foreground-muted px-3 py-2 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5"
        style={getEdgePadding(totalColumnCount - 1)}
      >
        {isRefetching && <Spinner size="xs" />}
      </div>
    )}
  </div>
);

const SortableVirtualTableWindowHeader = memo(SortableVirtualTableWindowHeaderInner) as <T>(
  props: SortableVirtualTableWindowHeaderProps<T>,
) => ReactElement;

// ============================================================================
// Main Component
// ============================================================================

type SortableVirtualTableWindowProps<T> = Omit<
  VirtualTableBaseProps<T>,
  "sorting" | "onSortingChange"
> & {
  onReorder: (newData: T[]) => void | Promise<void>;
  onReorderError?: (error: unknown) => void;
  getDragHandleLabel?: (row: T) => string;
  stickyHeaderOffset?: number;
  bottomPadding?: number;
  bufferSize?: number;
  horizontalPadding?: number;
  showExpandIndicator?: boolean;
  maxColumns?: number;
};

function SortableVirtualTableWindowInner<T>(
  {
    columns,
    data,
    getRowKey,
    rowHeight,
    onReorder,
    onReorderError,
    getDragHandleLabel,
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
  }: SortableVirtualTableWindowProps<T>,
  ref: ForwardedRef<VirtualTableHandle>,
) {
  const windowRef = useRef<WindowVirtualizerHandle>(null);
  const isExpandable = !!renderExpandedRow;

  const resolvedColumns = maxColumns != null ? columns.slice(0, maxColumns) : columns;
  const columnCount = resolvedColumns.length;

  const resolvedHorizontalPadding = horizontalPadding ?? getPagePadding();

  useImperativeHandle(
    ref,
    () => ({
      get scrollOffset() {
        return windowRef.current?.scrollOffset ?? 0;
      },
      get scrollSize() {
        if (typeof document !== "undefined") {
          return document.documentElement.scrollHeight;
        }
        return 0;
      },
      get viewportSize() {
        return windowRef.current?.viewportSize ?? 0;
      },
      scrollTo(offset: number) {
        if (typeof window !== "undefined") {
          window.scrollTo({ top: offset });
        }
      },
      scrollToIndex(index: number, opts?: { align?: "start" | "center" | "end" | "nearest" }) {
        windowRef.current?.scrollToIndex(index, opts);
      },
      scrollBy(offset: number) {
        if (typeof window !== "undefined") {
          window.scrollBy({ top: offset });
        }
      },
    }),
    [],
  );

  const [optimisticReorder, setOptimisticReorder] = useState<T[] | null>(null);
  const items = optimisticReorder ?? data;
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(() => items.map((row) => getRowKey(row)), [items, getRowKey]);

  const handleDragStart = useCallback((_event: DragStartEvent) => {}, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      void Result.tryPromise(async () => {
        const { active, over } = event;
        if (!over) return;

        const reorderIndices = getReorderIndices(
          items,
          (row) => getRowKey(row),
          active.id,
          over.id,
        );
        if (reorderIndices == null) return;

        const newItems = arrayMove(items, reorderIndices.oldIndex, reorderIndices.newIndex);
        setOptimisticReorder(newItems);

        setIsReordering(true);
        await onReorder(newItems);
        setOptimisticReorder(null);
        setIsReordering(false);
      }).then((result) => {
        if (Result.isError(result)) {
          // DndContext doesn't await onDragEnd; never throw from here.
          setOptimisticReorder(null);
          setIsReordering(false);
          onReorderError?.(result.error);
        }
      });
    },
    [items, getRowKey, onReorder, onReorderError],
  );

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

  useEffect(() => {
    if (!onEndReached || isLoadingMore || items.length === 0) return;
    if (typeof window === "undefined") return;

    const contentHeight = items.length * rowHeight;
    if (contentHeight < window.innerHeight + endReachedThreshold) {
      onEndReached();
    }
  }, [items.length, onEndReached, isLoadingMore, rowHeight, endReachedThreshold]);

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

  const shouldShowExpandIndicator = showExpandIndicator ?? !!expandedRows;

  const gridTemplateColumns = useMemo(() => {
    const colTemplates = resolvedColumns.map((col) =>
      col.size != null ? `${col.size}px` : "minmax(0, 1fr)",
    );
    const templates = [`${REORDER_COLUMN_WIDTH}px`, ...colTemplates];
    if (shouldShowExpandIndicator) {
      templates.push(`${EXPAND_COLUMN_WIDTH}px`);
    }
    return templates.join(" ");
  }, [resolvedColumns, shouldShowExpandIndicator]);

  const totalColumnCount = 1 + columnCount + (shouldShowExpandIndicator ? 1 : 0);

  const getEdgePadding = useCallback(
    (index: number): CSSProperties | undefined => {
      if (index === 0) return { paddingLeft: resolvedHorizontalPadding };
      if (index === totalColumnCount - 1) return { paddingRight: resolvedHorizontalPadding };
      return undefined;
    },
    [resolvedHorizontalPadding, totalColumnCount],
  );

  const rowElements = useMemo(
    () =>
      items.map((row, rowIndex) => {
        const rowKey = getRowKey(row);
        const isExpanded = expandedRows?.has(rowKey) ?? false;

        return (
          <TableRow
            key={rowKey}
            row={row}
            rowKey={rowKey}
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
            getDragHandleLabel={getDragHandleLabel}
          />
        );
      }),
    [
      items,
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
      getDragHandleLabel,
    ],
  );

  if (items.length === 0 && emptyState != null) {
    return (
      <div className={cn("flex w-full flex-col", className)} style={style}>
        <SortableVirtualTableWindowHeader
          stickyHeaderOffset={stickyHeaderOffset}
          gridTemplateColumns={gridTemplateColumns}
          columns={resolvedColumns}
          shouldShowExpandIndicator={shouldShowExpandIndicator}
          isRefetching={isRefetching}
          getEdgePadding={getEdgePadding}
          totalColumnCount={totalColumnCount}
        />
        <div className="flex-1">{emptyState}</div>
      </div>
    );
  }

  return (
    <div className={cn("relative flex w-full flex-col", className)} style={style}>
      {isReordering && (
        <div className="bg-background absolute inset-0 z-20 flex items-center justify-center">
          <div className="text-foreground-muted flex items-center gap-2 text-sm">
            <Spinner size="sm" />
            <span>Saving order...</span>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <SortableVirtualTableWindowHeader
            stickyHeaderOffset={stickyHeaderOffset}
            gridTemplateColumns={gridTemplateColumns}
            columns={resolvedColumns}
            shouldShowExpandIndicator={shouldShowExpandIndicator}
            isRefetching={isRefetching}
            getEdgePadding={getEdgePadding}
            totalColumnCount={totalColumnCount}
          />

          <div
            className={cn(
              "transition duration-200",
              isRefetching && "pointer-events-none opacity-50",
            )}
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

              {isLoadingMore && (
                <div
                  className="text-foreground-muted flex items-center justify-center gap-2 text-sm"
                  style={{ height: rowHeight }}
                >
                  <Spinner size="sm" />
                  <span>Loading...</span>
                </div>
              )}

              {bottomPadding > 0 && <div aria-hidden="true" style={{ height: bottomPadding }} />}
            </WindowVirtualizer>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

const SortableVirtualTableWindow = forwardRef(SortableVirtualTableWindowInner) as <T>(
  props: SortableVirtualTableWindowProps<T> & {
    ref?: ForwardedRef<VirtualTableHandle>;
  },
) => ReactElement;

export { SortableVirtualTableWindow };
