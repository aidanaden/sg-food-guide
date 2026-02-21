import { forwardRef, type ForwardedRef, type ReactElement } from "react";

import type { SortableVirtualTableProps } from "./sortable-types";
import { SortableVirtualTable } from "./sortable-virtual-table";
import type { VirtualTableProps, VirtualTableHandle } from "./types";
import { VirtualTableContainer } from "./virtual-table-container";
import { VirtualTableWindow } from "./virtual-table-window";

function VirtualTableInner<T>(props: VirtualTableProps<T>, ref: ForwardedRef<VirtualTableHandle>) {
  const {
    mode = "container",
    stickyHeaderOffset,
    bottomPadding,
    bufferSize,
    horizontalPadding,
    maxColumns,
    ...rest
  } = props;

  if (mode === "window") {
    return (
      <VirtualTableWindow
        ref={ref}
        stickyHeaderOffset={stickyHeaderOffset}
        bottomPadding={bottomPadding}
        bufferSize={bufferSize}
        horizontalPadding={horizontalPadding}
        maxColumns={maxColumns}
        {...rest}
      />
    );
  }

  return <VirtualTableContainer ref={ref} {...rest} />;
}

/**
 * A virtualized table component with sticky headers and sorting support.
 * Uses TanStack Table-compatible column definitions for familiarity.
 *
 * Features:
 * - Row virtualization for large datasets
 * - Sticky table header
 * - Click-to-sort columns (asc -> desc -> none)
 * - Infinite scroll support via onEndReached
 * - Empty state rendering
 * - Expandable rows with animated accordion
 * - Two modes: "container" (default) and "window" (full-screen mobile)
 *
 * @example
 * ```tsx
 * const columns: ColumnDef<User>[] = [
 *   {
 *     id: 'name',
 *     header: 'Name',
 *     accessorKey: 'name',
 *     enableSorting: true,
 *   },
 *   {
 *     id: 'email',
 *     header: 'Email',
 *     accessorKey: 'email',
 *   },
 *   {
 *     id: 'actions',
 *     header: 'Actions',
 *     cell: ({ row }) => <Button onClick={() => edit(row)}>Edit</Button>,
 *   },
 * ]
 *
 * // Container mode (default) - scrolls within container
 * <VirtualTable
 *   columns={columns}
 *   data={users}
 *   getRowKey={(row) => row.id}
 *   rowHeight={56}
 *   sorting={sorting}
 *   onSortingChange={setSorting}
 *   style={{ height: 'calc(100dvh - 17.5rem)' }}
 * />
 *
 * // With visibleRows - shows exactly N rows, page scrolls if exceeds viewport
 * <VirtualTable
 *   columns={columns}
 *   data={users}
 *   getRowKey={(row) => row.id}
 *   rowHeight={56}
 *   visibleRows={15}
 * />
 *
 * // Window mode - scrolls with browser window (mobile full-screen)
 * <VirtualTable
 *   mode="window"
 *   columns={columns}
 *   data={users}
 *   getRowKey={(row) => row.id}
 *   rowHeight={56}
 *   bottomPadding={80}
 * />
 * ```
 */
const VirtualTable = forwardRef(VirtualTableInner) as <T>(
  props: VirtualTableProps<T> & { ref?: ForwardedRef<VirtualTableHandle> },
) => ReactElement;

type VirtualTableCompound = (<T>(
  props: VirtualTableProps<T> & { ref?: ForwardedRef<VirtualTableHandle> },
) => ReactElement) & {
  Sortable: <T>(
    props: SortableVirtualTableProps<T> & { ref?: ForwardedRef<VirtualTableHandle> },
  ) => ReactElement;
};

const VirtualTableCompound = Object.assign(VirtualTable, {
  Sortable: SortableVirtualTable,
}) as VirtualTableCompound;

export { VirtualTableCompound as VirtualTable };
