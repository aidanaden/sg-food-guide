---
title: State Co-location (The Leaf Rule)
impact: CRITICAL
impactDescription: prevents cascade re-renders
tags: state, rerender, architecture, optimization
---

## State Co-location (The Leaf Rule)

Keep state in the lowest possible component in the tree that needs it. When state changes, React re-renders that component and its entire subtree - hoisting state higher than necessary causes needless re-renders of unrelated components.

**Incorrect (state hoisted too high):**

```tsx
function Parent() {
  const [filter, setFilter] = useState(""); // Only List needs this!
  return (
    <>
      <Header /> {/* Re-renders on every filter change */}
      <Sidebar /> {/* Re-renders on every filter change */}
      <List filter={filter} setFilter={setFilter} />
    </>
  );
}
```

**Correct (state in the leaf where it's used):**

```tsx
function Parent() {
  return (
    <>
      <Header /> {/* Never re-renders from filter changes */}
      <Sidebar /> {/* Never re-renders from filter changes */}
      <List /> {/* Owns its own filter state */}
    </>
  );
}

function List() {
  const [filter, setFilter] = useState(""); // Only List re-renders
  const filteredItems = items.filter((item) => item.name.includes(filter));
  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      {filteredItems.map((item) => (
        <Item key={item.id} item={item} />
      ))}
    </div>
  );
}
```

**Key insight:** Don't lift state "just in case" - lift it only when multiple components actually need it.
