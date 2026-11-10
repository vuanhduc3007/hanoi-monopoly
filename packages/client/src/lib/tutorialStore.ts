/**
 * Tutorial on/off and which tips this browser has already seen. Stored in
 * localStorage; on by default for a browser that never chose, so a friend
 * opening an invite link for the first time gets the hints.
 */
import { useSyncExternalStore } from 'react';

const ON_KEY = 'hanoi-monopoly:tutorial';
const SEEN_KEY = 'hanoi-monopoly:tips-seen';

function local(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function load(): { enabled: boolean; seen: Set<string> } {
  const ls = local();
  let seen: string[] = [];
  try {
    const v = JSON.parse(ls?.getItem(SEEN_KEY) ?? '[]') as unknown;
    if (Array.isArray(v)) seen = v.filter((x): x is string => typeof x === 'string');
  } catch {
    /* ignore */
  }
  return { enabled: ls?.getItem(ON_KEY) !== 'off', seen: new Set(seen) };
}

let snap = load();
const listeners = new Set<() => void>();

function save(next: typeof snap): void {
  snap = next;
  try {
    local()?.setItem(ON_KEY, next.enabled ? 'on' : 'off');
    local()?.setItem(SEEN_KEY, JSON.stringify([...next.seen]));
  } catch {
    /* private mode: still works for this page */
  }
  listeners.forEach((l) => l());
}

export const tutorial = {
  get: () => snap,
  setEnabled(on: boolean) {
    save({ ...snap, enabled: on });
  },
  markSeen(id: string) {
    if (snap.seen.has(id)) return;
    save({ ...snap, seen: new Set([...snap.seen, id]) });
  },
  /** Start the tips over (and switch them on). */
  restart() {
    save({ enabled: true, seen: new Set() });
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

export function useTutorial() {
  return useSyncExternalStore(tutorial.subscribe, tutorial.get, tutorial.get);
}
