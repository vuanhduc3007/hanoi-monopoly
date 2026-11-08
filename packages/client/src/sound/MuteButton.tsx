import { t } from '../i18n/vi';
import { useMuted } from './useSounds';

export function MuteButton() {
  const [muted, setMuted] = useMuted();
  return (
    <button className="mute" onClick={() => setMuted(!muted)} aria-pressed={muted} title={muted ? t.sound.unmute : t.sound.mute}>
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
