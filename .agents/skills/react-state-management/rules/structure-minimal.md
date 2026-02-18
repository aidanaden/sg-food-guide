---
title: Minimal Essential State
impact: HIGH
impactDescription: reduces bugs and complexity
tags: state, derived, calculation
---

## Minimal Essential State

State is the absolute minimum set of data your component needs to _remember_ over time. Anything that can be derived from props or existing state must be calculated during render - never store redundant or derived values in state.

**Incorrect (redundant derived state):**

```tsx
function ProductList({ products }: Props) {
  const [items, setItems] = useState(products);
  const [filteredItems, setFilteredItems] = useState(products); // Derived!
  const [totalCount, setTotalCount] = useState(products.length); // Derived!
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const filtered = items.filter((p) => p.name.includes(filter));
    setFilteredItems(filtered);
    setTotalCount(filtered.length);
  }, [items, filter]);

  return <div>Showing {totalCount} items...</div>;
}
```

**Correct (derive during render):**

```tsx
function ProductList({ products }: Props) {
  const [filter, setFilter] = useState("");

  // Derived values calculated during render - no state needed
  const filteredItems = products.filter((p) => p.name.includes(filter));
  const totalCount = filteredItems.length;

  return <div>Showing {totalCount} items...</div>;
}
```

**The test:** Ask "Can I compute this from props or other state?" If yes, it's not state - calculate it.
