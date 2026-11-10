import { useEffect, useRef } from 'react';
import type { PublicState } from '@hanoi-monopoly/engine';
import { t } from '../i18n/vi';
import { isMyTurn, me, nameOf } from '../lib/selectors';
import { nextTip, TIP_IDS, tipById, type TipCtx, type TipScope } from '../lib/tutorial';
import { tutorial, useTutorial } from '../lib/tutorialStore';
import { setTutorial } from '../net/connection';
import type { RoomView } from '../net/protocol';
import { useAnimSettled, useStore } from '../store';

/** A tip shown for at least this long counts as read once its situation is over. */
const READ_MS = 1500;

/**
 * Tutorial card: the next tip that fits what is happening in the game, with
 * the buttons it talks about pulsing. A tip goes away for good when "Đã hiểu"
 * is pressed, or when the player has done what it explained.
 */
export function Coach({ state, room, scope }: { state: PublicState; room: RoomView; scope: TipScope }) {
  const { enabled, seen } = useTutorial();
  const log = useStore((s) => s.log);
  const settled = useAnimSettled();
  const shown = useRef<{ id: string; at: number } | null>(null);
  const self = me(room, state);
  const ctx: TipCtx | null = self
    ? { state, self, myTurn: isMyTurn(room, state), events: log.map((l) => l.event), name: (id) => nameOf(room, id) }
    : null;
  // Wait for the dice and the piece, so the tip matches the buttons on screen.
  const next = enabled && ctx && (settled || scope !== 'game') ? nextTip(ctx, scope, seen) : null;
  const current = next?.tip.id ?? null;

  useEffect(() => {
    const prev = shown.current;
    if (prev && prev.id !== current) {
      const over = ctx && !tipById(prev.id)?.when(ctx);
      if (over) {
        // The player did what the tip explained (bought, rolled…): it has done its job.
        if (Date.now() - prev.at >= READ_MS) tutorial.markSeen(prev.id);
        shown.current = null;
      } else if (current === null) {
        return; // only hidden for a moment (pieces moving): keep it
      }
    }
    if (current && shown.current?.id !== current) shown.current = { id: current, at: Date.now() };
  });

  if (!next) return null;
  const text = t.tutorial.tips[next.tip.id]?.(next.params);
  if (!text) return null;
  const targets = (next.tip.target ?? '').split(' ').filter(Boolean);
  const done = TIP_IDS.filter((id) => seen.has(id)).length;
  return (
    <section className={`panel coach coach-${scope}`} role="note" aria-live="polite">
      {targets.length > 0 && (
        <style>{`${targets.map((k) => `[data-coach~="${k}"]`).join(',')}{animation:coach-pulse 1.3s ease-in-out infinite}`}</style>
      )}
      <div className="coach-head">
        <strong>🎓 {text.title}</strong>
        <span className="muted coach-count">{t.tutorial.progress(done, TIP_IDS.length)}</span>
      </div>
      {text.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <div className="buttons">
        <button className="primary" onClick={() => tutorial.markSeen(next.tip.id)}>
          {t.tutorial.gotIt}
        </button>
        <button className="link" onClick={() => setTutorial(false)}>
          {t.tutorial.turnOff}
        </button>
      </div>
    </section>
  );
}

/** 🎓 in the game bar: tutorial on/off. */
export function TutorialButton() {
  const { enabled } = useTutorial();
  return (
    <button
      className={`tutorial-toggle${enabled ? ' on' : ''}`}
      aria-pressed={enabled}
      title={t.tutorial.button(enabled)}
      aria-label={t.tutorial.button(enabled)}
      onClick={() => setTutorial(!enabled)}
    >
      🎓
    </button>
  );
}

/** Checkbox for Home / Lobby, with "start over" once some tips were seen. */
export function TutorialSetting({ label }: { label: string }) {
  const { enabled, seen } = useTutorial();
  return (
    <div className="tutorial-setting">
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(e) => setTutorial(e.target.checked)} /> {label}
      </label>
      {seen.size > 0 && (
        <button className="link" onClick={() => setTutorial(true, true)}>
          {t.tutorial.restart}
        </button>
      )}
    </div>
  );
}
