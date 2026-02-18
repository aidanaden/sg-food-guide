---
title: Avoid Unnecessary Effects
impact: CRITICAL
impactDescription: eliminates redundant renders, race conditions, and cascading update bugs
tags: effects, useEffect, derived-state, event-handlers, data-fetching
---

## Avoid Unnecessary Effects

Effects are for synchronizing with _external systems_ (DOM, network, third-party widgets). If no external system is involved, you almost certainly don't need an Effect. Unnecessary Effects cause extra render passes, introduce bugs, and make data flow hard to trace.

### 1. Derive during render — don't sync state with Effects

**Incorrect (Effect to sync derived state):**

```tsx
function Form() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fullName, setFullName] = useState("");

  // Renders with stale fullName, then re-renders with correct value
  useEffect(() => {
    setFullName(firstName + " " + lastName);
  }, [firstName, lastName]);
}
```

**Correct (calculate during render):**

```tsx
function Form() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const fullName = firstName + " " + lastName; // Always in sync, one render
}
```

For expensive calculations, use `useMemo` — not `useEffect` + `setState`:

```tsx
const visibleTodos = useMemo(() => getFilteredTodos(todos, filter), [todos, filter]);
```

### 2. Handle user events in event handlers — not Effects

**The test:** Was this caused by a specific user interaction? → event handler. Was it caused by the component appearing on screen? → Effect.

**Incorrect (event logic in Effect):**

```tsx
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name} to cart!`);
  }
}, [product]);
```

**Correct (logic in event handler):**

```tsx
function handleBuyClick() {
  addToCart(product);
  showNotification(`Added ${product.name} to cart!`);
}
```

### 3. Don't chain Effects to cascade state updates

Chains of Effects that set state to trigger other Effects cause multiple re-renders and are fragile to refactor.

**Incorrect (chain of Effects):**

```tsx
useEffect(() => {
  setGoldCount((c) => c + 1);
}, [card]);
useEffect(() => {
  setRound((r) => r + 1);
}, [goldCount]);
useEffect(() => {
  setIsGameOver(true);
}, [round]);
```

**Correct (calculate during render + update in event handler):**

```tsx
const isGameOver = round > 5; // Derive during render

function handlePlaceCard(nextCard) {
  setCard(nextCard);
  if (nextCard.gold) {
    if (goldCount < 3) {
      setGoldCount(goldCount + 1);
    } else {
      setGoldCount(0);
      setRound(round + 1);
    }
  }
}
```

### 4. Reset state with `key` — not Effects

**Incorrect:**

```tsx
useEffect(() => {
  setComment("");
}, [userId]);
```

**Correct:**

```tsx
<Profile userId={userId} key={userId} />
```

### 5. Notify parents in event handlers — not Effects

**Incorrect:**

```tsx
useEffect(() => {
  onChange(isOn);
}, [isOn, onChange]);
```

**Correct:**

```tsx
function updateToggle(nextIsOn: boolean) {
  setIsOn(nextIsOn);
  onChange(nextIsOn); // Both updates in one event, one render pass
}
```

### 6. Prefer derived IDs over synced state

When a prop changes and you need to "adjust" state, often you can store an ID and derive the rest:

```tsx
function List({ items }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selection = items.find((item) => item.id === selectedId) ?? null;
  // No Effect needed — selection auto-updates when items change
}
```

### When Effects ARE appropriate

- Synchronizing with external systems (DOM APIs, WebSocket, third-party widgets)
- Analytics events fired because the component was _displayed_
- Data fetching (but prefer React Query / framework mechanisms over raw `useEffect` + `fetch`)
- Subscribing to external stores (but prefer `useSyncExternalStore`)
