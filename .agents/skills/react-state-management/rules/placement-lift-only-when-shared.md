---
title: Lift State Only When Shared
impact: HIGH
impactDescription: avoids premature lifting
tags: state, rerender, architecture
---

## Lift State Only When Shared

Only move state up the component tree when multiple sibling components need access to the same piece of state. The lowest common ancestor that needs the data should own the state.

**Incorrect (premature lifting):**

```tsx
// State lifted to App "just in case" something else needs it
function App() {
  const [selectedTab, setSelectedTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState(""); // Only SearchPanel uses this

  return (
    <div>
      <TabBar selected={selectedTab} onSelect={setSelectedTab} />
      <SearchPanel query={searchQuery} setQuery={setSearchQuery} />
      <Content tab={selectedTab} />
    </div>
  );
}
```

**Correct (state lives where it's needed):**

```tsx
function App() {
  // selectedTab stays lifted - TabBar and Content both need it
  const [selectedTab, setSelectedTab] = useState("home");

  return (
    <div>
      <TabBar selected={selectedTab} onSelect={setSelectedTab} />
      <SearchPanel /> {/* Owns its own search state */}
      <Content tab={selectedTab} />
    </div>
  );
}

function SearchPanel() {
  const [searchQuery, setSearchQuery] = useState(""); // Lives here
  return <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />;
}
```

**When to lift:** Only when you have concrete evidence that multiple components need the state, not speculation about future needs.
