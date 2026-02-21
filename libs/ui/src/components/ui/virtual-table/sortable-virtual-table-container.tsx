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
import { VList, type VListHandle } from "virtua";

import { cn } from "../../../utils";
import { getItemIndexById, getReorderIndices } from "../../sortable/reorder";
import { Button } from "../button";
import { Collapsible } from "../collapsible";
import { Spinner } from "../spinner";
import type { ColumnDef, VirtualTableBaseProps, VirtualTableHandle } from "./types";
import { getCellValue } from "./utils";

/** Width of the reorder drag handle column in pixels */
const REORDER_COLUMN_WIDTH = 40;

/** Width of the expand indicator column in pixels */
const EXPAND_COLUMN_WIDTH = 32;

/** Header height in pixels (py-3 padding + text-xs line height) */
const HEADER_HEIGHT = 40;

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
  const rowStyle = { gridTemplateColumns, height: rowHeight };
  const rowCells = (
    <>
      {/* Reorder handle */}
      <div className="flex items-center justify-center px-1">
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
    <div ref={setNodeRef} style={style} className={cn("border-border w-full border-b")}>
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
    prevProps.getDragHandleLabel === nextProps.getDragHandleLabel
  );
}) as <T>(props: TableRowProps<T>) => ReactElement;

// ============================================================================
// Main Component
// ============================================================================

type SortableVirtualTableContainerProps<T> = Omit<
  VirtualTableBaseProps<T>,
  "sorting" | "onSortingChange"
> & {
  onReorder: (newData: T[]) => void | Promise<void>;
  onReorderError?: (error: unknown) => void;
  getDragHandleLabel?: (row: T) => string;
  /** Whether to show expand indicator column when expandedRows is provided */
  showExpandIndicator?: boolean;
};

function SortableVirtualTableContainerInner<T>(
  {
    columns,
    data,
    getRowKey,
    rowHeight,
    onReorder,
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
    visibleRows,
    showExpandIndicator,
    onReorderError,
  }: SortableVirtualTableContainerProps<T>,
  ref: ForwardedRef<VirtualTableHandle>,
) {
  const listRef = useRef<VListHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isExpandable = !!renderExpandedRow;

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

  const [optimisticReorder, setOptimisticReorder] = useState<T[] | null>(null);
  const items = optimisticReorder ?? data;
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const itemIds = useMemo(() => items.map((row) => getRowKey(row)), [items, getRowKey]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setDraggingIndex(getItemIndexById(items, (row) => getRowKey(row), event.active.id));
    },
    [items, getRowKey],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      void Result.tryPromise(async () => {
        setDraggingIndex(null);
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

  const handleScrollEnd = useCallback(() => {
    if (!onEndReached || isLoadingMore) return;
    const handle = listRef.current;
    if (!handle) return;
    const distanceFromEnd = handle.scrollSize - handle.scrollOffset - handle.viewportSize;
    if (distanceFromEnd < endReachedThreshold) {
      onEndReached();
    }
  }, [onEndReached, isLoadingMore, endReachedThreshold]);

  useEffect(() => {
    if (!onEndReached || isLoadingMore || items.length === 0) return;
    const el = containerRef.current;
    if (!el) return;

    const availableHeight = el.clientHeight - HEADER_HEIGHT;
    const contentHeight = items.length * rowHeight;
    if (contentHeight < availableHeight + endReachedThreshold) {
      onEndReached();
    }
  }, [items.length, onEndReached, isLoadingMore, rowHeight, endReachedThreshold]);

  const shouldShowExpandIndicator = showExpandIndicator ?? !!expandedRows;

  const gridTemplateColumns = useMemo(() => {
    const colTemplates = columns.map((col) =>
      col.size != null ? `${col.size}px` : "minmax(0, 1fr)",
    );
    const templates = [`${REORDER_COLUMN_WIDTH}px`, ...colTemplates];
    if (shouldShowExpandIndicator) {
      templates.push(`${EXPAND_COLUMN_WIDTH}px`);
    }
    return templates.join(" ");
  }, [columns, shouldShowExpandIndicator]);

  const containerStyle =
    visibleRows != null ? { ...style, height: visibleRows * rowHeight + HEADER_HEIGHT } : style;

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
            columns={columns}
            gridTemplateColumns={gridTemplateColumns}
            rowHeight={rowHeight}
            isExpanded={isExpanded}
            isExpandable={isExpandable}
            shouldShowExpandIndicator={shouldShowExpandIndicator}
            onRowClick={onRowClick}
            renderExpandedRow={renderExpandedRow}
            getDragHandleLabel={getDragHandleLabel}
          />
        );
      }),
    [
      items,
      getRowKey,
      expandedRows,
      columns,
      gridTemplateColumns,
      rowHeight,
      isExpandable,
      shouldShowExpandIndicator,
      onRowClick,
      renderExpandedRow,
      getDragHandleLabel,
    ],
  );

  const headerElement = useMemo(
    () => (
      <div className="bg-surface grid w-full shrink-0 border-b" style={{ gridTemplateColumns }}>
        <div className="text-foreground-muted px-3 py-1 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5" />
        {columns.map((column, index) => {
          const isLastColumn = index === columns.length - 1 && !shouldShowExpandIndicator;
          return (
            <div
              key={column.id}
              className="text-foreground-muted overflow-hidden px-3 py-1 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5"
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
          <div className="text-foreground-muted px-3 py-1 text-left text-xs font-medium tracking-wider uppercase sm:py-1.5">
            {isRefetching && <Spinner size="xs" />}
          </div>
        )}
      </div>
    ),
    [columns, gridTemplateColumns, shouldShowExpandIndicator, isRefetching],
  );

  if (items.length === 0 && emptyState != null) {
    return (
      <div className="relative">
        <div
          ref={containerRef}
          className={cn("flex w-full max-w-full flex-col overflow-hidden", className)}
          style={containerStyle}
        >
          {headerElement}
          <div className="flex-1">{emptyState}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isReordering && (
        <div className="bg-background absolute inset-0 z-10 flex items-center justify-center">
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
          <div
            ref={containerRef}
            className={cn("flex w-full max-w-full flex-col overflow-hidden", className)}
            style={containerStyle}
          >
            {headerElement}

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
              keepMounted={draggingIndex !== null ? [draggingIndex] : []}
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
        </SortableContext>
      </DndContext>
    </div>
  );
}

const SortableVirtualTableContainer = forwardRef(SortableVirtualTableContainerInner) as <T>(
  props: SortableVirtualTableContainerProps<T> & {
    ref?: ForwardedRef<VirtualTableHandle>;
  },
) => ReactElement;

export { SortableVirtualTableContainer };
