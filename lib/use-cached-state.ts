"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";

const subscribe = () => () => {};
const serverSnapshot = () => null;

// Render the complete shell on the server, then restore the browser's initial
// cache during hydration. Local storage never changes the first hydration pass.
export function useCachedState<T>(readInitial: () => T, serverValue: T): [T, Dispatch<SetStateAction<T>>] {
  const reader = useRef(readInitial);
  const fallback = useRef(serverValue);
  const restored = useRef<{ value: T } | null>(null);
  const [live, setLive] = useState<{ value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    if (restored.current === null) restored.current = { value: reader.current() };
    return restored.current;
  }, []);
  const cached = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const update = useCallback<Dispatch<SetStateAction<T>>>(action => {
    setLive(previous => ({ value: typeof action === "function"
      ? (action as (value: T) => T)(previous ? previous.value : restored.current ? restored.current.value : fallback.current)
      : action }));
  }, []);
  return [live ? live.value : cached ? cached.value : serverValue, update];
}
