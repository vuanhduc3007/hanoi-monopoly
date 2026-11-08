/**
 * Sounds from GDD §8.3, synthesised with Web Audio (no audio files to ship):
 * xúc xắc trong bát, còi CSGT, chuông xe đạp, "ting ting", trống hội, pháo hoa.
 */
import { defaultData as D, type GameEvent } from '@hanoi-monopoly/engine';

export type SoundName = 'dice' | 'whistle' | 'bell' | 'ting' | 'drum' | 'flip' | 'fireworks' | 'turn';

const MUTE_KEY = 'hanoi-monopoly:muted';
let ctx: AudioContext | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function onMuteChange(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Which sounds a batch of events deserves (pure — tested). */
export function soundsFor(events: GameEvent[], me: string | null): SoundName[] {
  const out: SoundName[] = [];
  const add = (n: SoundName) => !out.includes(n) && out.push(n);
  for (const e of events) {
    switch (e.type) {
      case 'diceRolled':
        if (e.purpose === 'normal' || e.purpose === 'jail' || e.purpose === 'reroll') add('dice');
        break;
      case 'jailed':
        add('whistle');
        break;
      case 'salary':
        add('bell');
        break;
      case 'purchased':
        add('ting');
        break;
      case 'auctionEnded':
        if (e.winner) add('ting');
        break;
      case 'cardDrawn':
        add(D.cards[e.cardId as string]?.deck === 'event' ? 'drum' : 'flip');
        break;
      case 'gameOver':
        add('fireworks');
        break;
      case 'turnStarted':
        if (e.player === me) add('turn');
        break;
    }
  }
  return out;
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Browsers only allow audio after a user gesture: unlock on the first click. */
export function unlockAudioOnGesture(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function envelope(a: AudioContext, t0: number, attack: number, decay: number, peak: number): GainNode {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  g.connect(a.destination);
  return g;
}

function tone(a: AudioContext, t0: number, freq: number, type: OscillatorType, attack: number, decay: number, peak: number) {
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.connect(envelope(a, t0, attack, decay, peak));
  o.start(t0);
  o.stop(t0 + attack + decay + 0.05);
  return o;
}

function noise(a: AudioContext, t0: number, dur: number, peak: number, filter: BiquadFilterType, freq: number, q = 1) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, dur + 0.05);
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(envelope(a, t0, 0.003, dur, peak));
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const SYNTHS: Record<SoundName, (a: AudioContext, t: number) => void> = {
  // Dice rattling in a ceramic bowl.
  dice: (a, t) => {
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.045 + Math.random() * 0.03;
      noise(a, at, 0.04, 0.35, 'bandpass', 2200 + Math.random() * 1800, 6);
      tone(a, at, 1800 + Math.random() * 900, 'triangle', 0.002, 0.08, 0.06);
    }
  },
  // Police whistle: two trilled blasts.
  whistle: (a, t) => {
    for (const start of [0, 0.42]) {
      const o = a.createOscillator();
      o.frequency.setValueAtTime(2900, t + start);
      const lfo = a.createOscillator();
      lfo.frequency.value = 28;
      const depth = a.createGain();
      depth.gain.value = 140;
      lfo.connect(depth).connect(o.frequency);
      o.connect(envelope(a, t + start, 0.02, start ? 0.55 : 0.3, 0.18));
      o.start(t + start);
      lfo.start(t + start);
      o.stop(t + start + 0.7);
      lfo.stop(t + start + 0.7);
    }
  },
  // Bicycle bell: ring-ring.
  bell: (a, t) => {
    for (const start of [0, 0.16]) {
      for (const [f, p] of [
        [2093, 0.16],
        [3140, 0.08],
        [4186, 0.04],
      ] as const) {
        tone(a, t + start, f, 'sine', 0.003, 0.9, p);
      }
    }
  },
  // Bank transfer "ting ting".
  ting: (a, t) => {
    tone(a, t, 1318.5, 'triangle', 0.004, 0.45, 0.22);
    tone(a, t + 0.14, 1760, 'triangle', 0.004, 0.6, 0.22);
  },
  // Festival drum: three deep hits.
  drum: (a, t) => {
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = a.createOscillator();
      o.frequency.setValueAtTime(150, t + d);
      o.frequency.exponentialRampToValueAtTime(48, t + d + 0.3);
      o.connect(envelope(a, t + d, 0.005, 0.45, i === 2 ? 0.7 : 0.5));
      o.start(t + d);
      o.stop(t + d + 0.5);
      noise(a, t + d, 0.06, 0.12, 'lowpass', 900);
    });
  },
  // Paper card flip.
  flip: (a, t) => noise(a, t, 0.09, 0.18, 'highpass', 2500),
  // Fireworks: rising whistle, then crackles.
  fireworks: (a, t) => {
    const o = a.createOscillator();
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    o.connect(envelope(a, t, 0.05, 0.6, 0.05));
    o.start(t);
    o.stop(t + 0.7);
    noise(a, t + 0.65, 0.5, 0.5, 'lowpass', 1200);
    for (let i = 0; i < 14; i++) noise(a, t + 0.8 + Math.random() * 0.9, 0.03, 0.25, 'highpass', 3000);
  },
  // Wooden block: it's your turn.
  turn: (a, t) => tone(a, t, 820, 'sine', 0.002, 0.12, 0.2),
};

export function play(name: SoundName): void {
  if (muted) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  SYNTHS[name](a, a.currentTime + 0.01);
}

export const SOUND_NAMES = Object.keys(SYNTHS) as SoundName[];
