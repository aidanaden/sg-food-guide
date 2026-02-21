import { createStart } from '@tanstack/react-start';

export const startInstance = createStart(() => ({
  // hydrateStart mutates this array with a built-in adapter.
  // Returning an explicit array avoids `undefined.push(...)` at runtime.
  serializationAdapters: [],
}));
