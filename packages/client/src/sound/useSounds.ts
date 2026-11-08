import { useEffect, useRef, useSyncExternalStore } from 'react';
import { store } from '../store';
import { isMuted, onMuteChange, play, setMuted, soundsFor } from './sound';

/** Plays sounds for log lines that arrive while mounted (not for history). */
export function useGameSounds(me: string | null): void {
  const seen = useRef<number>(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const log = store.get().log;
    seen.current = log.length ? log[log.length - 1].id : 0;
    return store.subscribe(() => {
      const fresh = store.get().log.filter((l) => l.id > seen.current);
      if (!fresh.length) return;
      seen.current = fresh[fresh.length - 1].id;
      soundsFor(
        fresh.map((l) => l.event),
        me,
      ).forEach((name, i) => setTimeout(() => play(name), i * 180));
    });
  }, [me]);
}

export function useMuted(): [boolean, (m: boolean) => void] {
  const muted = useSyncExternalStore(onMuteChange, isMuted);
  return [muted, setMuted];
}
