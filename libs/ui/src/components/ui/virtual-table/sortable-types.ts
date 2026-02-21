import type { VirtualTableProps } from "./types";

export type SortableVirtualTableProps<T> = Omit<
  VirtualTableProps<T>,
  "sorting" | "onSortingChange"
> & {
  /** Callback fired when rows are reordered. Receives the new array order. */
  onReorder: (newData: T[]) => void | Promise<void>;
  /** Accessibility label for the drag handle button */
  getDragHandleLabel?: (row: T) => string;
};
