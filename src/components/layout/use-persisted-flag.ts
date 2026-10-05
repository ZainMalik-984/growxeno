"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A boolean persisted in localStorage, read without an effect.
 *
 * Reading localStorage during render breaks server rendering, and reading it in
 * a `useEffect` that calls `setState` causes the cascading render that
 * react-hooks/set-state-in-effect (correctly) rejects.
 *
 * `useSyncExternalStore` is the supported answer: it takes a server snapshot
 * (the fallback) and a client snapshot (the stored value), so the markup
 * matches on hydration and then settles to the persisted value.
 *
 * There is deliberately NO memo cache of stored values. Snapshots here are
 * booleans, which `useSyncExternalStore` compares by value, so caching buys
 * nothing — and an earlier version that did cache kept returning a stale value
 * after the underlying storage changed.
 *
 * The listener set exists because the `storage` event does not fire in the tab
 * that performed the write, so this module notifies its own subscribers.
 */

const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function read(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    // Storage can be unavailable (private mode, blocked site data). The
    // fallback is perfectly usable, so this is not worth surfacing.
    return fallback;
  }
}

/** Persist a flag and notify every hook watching that key. */
export function setPersistedFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // See above. Without storage the flag simply does not persist.
  }
  for (const listener of listeners) listener();
}

export function usePersistedFlag(key: string, fallback: boolean): boolean {
  const getSnapshot = useCallback(() => read(key, fallback), [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
