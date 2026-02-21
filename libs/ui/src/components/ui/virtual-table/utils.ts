import type { ColumnDef } from "./types";

/**
 * Get the cell value from a row based on the column definition.
 * Uses accessorFn if provided, otherwise falls back to accessorKey.
 */
export function getCellValue<T>(row: T, column: ColumnDef<T>): unknown {
  if (column.accessorFn != null) {
    return column.accessorFn(row);
  }
  if (column.accessorKey != null) {
    return row[column.accessorKey];
  }
  return undefined;
}
