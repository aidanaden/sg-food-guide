import { forwardRef, type ForwardedRef, type ReactElement } from "react";

import type { SortableVirtualTableProps } from "./sortable-types";
import { SortableVirtualTableContainer } from "./sortable-virtual-table-container";
import { SortableVirtualTableWindow } from "./sortable-virtual-table-window";
import type { VirtualTableHandle } from "./types";

function SortableVirtualTableInner<T>(
  props: SortableVirtualTableProps<T>,
  ref: ForwardedRef<VirtualTableHandle>,
) {
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
      <SortableVirtualTableWindow
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

  return <SortableVirtualTableContainer ref={ref} {...rest} />;
}

const SortableVirtualTable = forwardRef(SortableVirtualTableInner) as <T>(
  props: SortableVirtualTableProps<T> & { ref?: ForwardedRef<VirtualTableHandle> },
) => ReactElement;

export { SortableVirtualTable };
