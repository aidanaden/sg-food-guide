type ReorderIndices = {
  oldIndex: number;
  newIndex: number;
};

export function getItemIndexById<T, TId>(
  items: readonly T[],
  getItemId: (item: T, index: number) => TId,
  id: TId,
): number | null {
  const index = items.findIndex((item, itemIndex) => getItemId(item, itemIndex) === id);
  return index >= 0 ? index : null;
}

export function getReorderIndices<T, TId>(
  items: readonly T[],
  getItemId: (item: T, index: number) => TId,
  activeId: TId,
  overId: TId,
): ReorderIndices | null {
  if (activeId === overId) {
    return null;
  }

  const oldIndex = getItemIndexById(items, getItemId, activeId);
  const newIndex = getItemIndexById(items, getItemId, overId);
  if (oldIndex == null || newIndex == null) {
    return null;
  }

  return { oldIndex, newIndex };
}
