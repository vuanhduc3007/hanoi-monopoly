/**
 * Đông Hồ-style woodcut art as inline SVG: thick ink outlines, flat earth
 * colours, hatching. Placeholder-quality but consistent; a painter can later
 * replace any icon by key without touching game code.
 */
import type { ReactNode } from 'react';

const INK = '#2B2522';
const PAPER = '#F3E9D2';
const RED = '#B8312F';
const GOLD = '#E3A72F';
const INDIGO = '#2E4A7D';
const GREEN = '#5F7F3A';
const BROWN = '#8A5A3B';
const PINK = '#E7A6A1';
const SKY = '#8FB3C9';

const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Svg({ children, size = 48, title, className }: { children: ReactNode; size?: number | string; title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={className} role={title ? 'img' : 'presentation'} aria-label={title}>
      {children}
    </svg>
  );
}

/** Parallel hatch lines clipped to a box — the woodcut texture. */
const Hatch = ({ x, y, w, h, gap = 4 }: { x: number; y: number; w: number; h: number; gap?: number }) => (
  <g stroke={INK} strokeWidth={0.8} opacity={0.55}>
    {Array.from({ length: Math.floor((w + h) / gap) }, (_, i) => {
      const d = i * gap;
      const x1 = x + Math.max(0, d - h);
      const y1 = y + Math.min(h, d);
      const x2 = x + Math.min(w, d);
      const y2 = y + Math.max(0, d - w);
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
    })}
  </g>
);

const Water = ({ y = 36 }: { y?: number }) => (
  <g>
    <rect x={2} y={y} width={44} height={46 - y} fill={SKY} {...s} />
    {[0, 1].map((r) => (
      <path
        key={r}
        d={`M6 ${y + 4 + r * 4} q3 -2 6 0 t6 0 t6 0 t6 0 t6 0 t6 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1}
      />
    ))}
  </g>
);

const TubeHouse = ({ x, w, h, roof = RED, wall = PAPER }: { x: number; w: number; h: number; roof?: string; wall?: string }) => (
  <g>
    <rect x={x} y={42 - h} width={w} height={h} fill={wall} {...s} />
    <path d={`M${x - 1} ${42 - h} L${x + w / 2} ${36 - h} L${x + w + 1} ${42 - h} Z`} fill={roof} {...s} />
    <rect x={x + w / 2 - 2} y={36} width={4} height={6} fill={BROWN} {...s} strokeWidth={1.4} />
  </g>
);

export const TILE_ICONS: Record<string, () => JSX.Element> = {
  rural: () => (
    <>
      <circle cx={36} cy={12} r={6} fill={GOLD} {...s} />
      <path d="M2 30 Q24 24 46 30 L46 46 L2 46 Z" fill={GREEN} {...s} />
      <Hatch x={4} y={32} w={40} h={12} gap={5} />
      <path d="M8 30 L14 20 L20 30 Z" fill={BROWN} {...s} />
      <rect x={10} y={26} width={8} height={6} fill={PAPER} {...s} />
    </>
  ),
  district: () => (
    <>
      <TubeHouse x={4} w={10} h={18} />
      <TubeHouse x={18} w={10} h={24} roof={BROWN} />
      <TubeHouse x={32} w={11} h={16} />
      <line x1={2} y1={42} x2={46} y2={42} {...s} />
    </>
  ),
  stadium: () => (
    <>
      <ellipse cx={24} cy={30} rx={20} ry={10} fill={PAPER} {...s} />
      <ellipse cx={24} cy={30} rx={12} ry={5} fill={GREEN} {...s} />
      <path d="M8 22 L8 14 M40 22 L40 14" {...s} />
      <path d="M8 14 l6 3 -6 3 M40 14 l6 3 -6 3" fill={RED} {...s} />
    </>
  ),
  tower: () => (
    <>
      <rect x={17} y={6} width={14} height={36} fill={SKY} {...s} />
      <path d="M17 6 L24 2 L31 6" fill={GOLD} {...s} />
      {[12, 18, 24, 30, 36].map((y) => (
        <line key={y} x1={19} y1={y} x2={29} y2={y} stroke={INK} strokeWidth={1} />
      ))}
      <rect x={6} y={26} width={9} height={16} fill={PAPER} {...s} />
      <rect x={33} y={20} width={9} height={22} fill={PAPER} {...s} />
      <line x1={2} y1={42} x2={46} y2={42} {...s} />
    </>
  ),
  bridge: () => (
    <>
      <Water y={32} />
      <path d="M2 30 L46 30" {...s} strokeWidth={3} />
      {[2, 13, 24, 35].map((x) => (
        <path key={x} d={`M${x} 30 L${x + 5.5} 16 L${x + 11} 30 M${x + 5.5} 16 L${x + 5.5} 30`} fill="none" {...s} stroke={BROWN} />
      ))}
      <path d="M2 16 L46 16" {...s} stroke={BROWN} />
      <rect x={20} y={30} width={8} height={10} fill={BROWN} {...s} />
    </>
  ),
  complex: () => (
    <>
      <rect x={4} y={14} width={12} height={28} fill={PAPER} {...s} />
      <rect x={18} y={8} width={12} height={34} fill={PINK} {...s} />
      <rect x={32} y={18} width={12} height={24} fill={PAPER} {...s} />
      {[18, 24, 30, 36].map((y) => (
        <g key={y} stroke={INK} strokeWidth={1}>
          <line x1={6} y1={y} x2={14} y2={y} />
          <line x1={34} y1={y + 2} x2={42} y2={y + 2} />
        </g>
      ))}
      <Hatch x={19} y={10} w={10} h={30} />
      <circle cx={10} cy={40} r={4} fill={GREEN} {...s} />
      <line x1={2} y1={42} x2={46} y2={42} {...s} />
    </>
  ),
  mall: () => (
    <>
      <rect x={6} y={14} width={36} height={28} fill={PAPER} {...s} />
      <rect x={6} y={14} width={36} height={7} fill={RED} {...s} />
      <path d="M18 30 h12 l-2 10 h-8 Z" fill={GOLD} {...s} />
      <path d="M21 30 q3 -6 6 0" fill="none" {...s} />
      <line x1={2} y1={42} x2={46} y2={42} {...s} />
    </>
  ),
  mound: () => (
    <>
      <path d="M2 42 Q24 14 46 42 Z" fill={GREEN} {...s} />
      <Hatch x={10} y={28} w={28} h={14} gap={5} />
      <line x1={24} y1={22} x2={24} y2={6} {...s} />
      <path d="M24 6 L36 10 L24 14 Z" fill={RED} {...s} />
    </>
  ),
  flagpole: () => (
    <>
      <path d="M12 42 L14 28 L34 28 L36 42 Z" fill={BROWN} {...s} />
      <path d="M17 28 L18 18 L30 18 L31 28 Z" fill={PAPER} {...s} />
      <line x1={24} y1={18} x2={24} y2={4} {...s} />
      <path d="M24 4 L38 8 L24 12 Z" fill={RED} {...s} />
      <circle cx={30} cy={8} r={1.5} fill={GOLD} />
    </>
  ),
  westlake: () => (
    <>
      <Water y={32} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={20 - i * 0} y={10 + i * 5} width={8} height={5} fill={i % 2 ? PAPER : RED} {...s} strokeWidth={1.5} />
      ))}
      <path d="M17 30 L31 30 L28 32 L20 32 Z" fill={BROWN} {...s} />
      <path d="M22 10 L24 5 L26 10" fill={GOLD} {...s} />
      <circle cx={38} cy={12} r={5} fill={GOLD} {...s} />
    </>
  ),
  oldquarter: () => (
    <>
      <rect x={10} y={20} width={28} height={22} fill={PAPER} {...s} />
      <path d="M6 22 Q24 10 42 22 L38 22 Q24 14 10 22 Z" fill={RED} {...s} />
      <path d="M6 22 Q24 6 42 22" fill="none" {...s} />
      <rect x={20} y={30} width={8} height={12} fill={BROWN} {...s} />
      <ellipse cx={14} cy={28} rx={3} ry={4} fill={RED} {...s} strokeWidth={1.4} />
      <ellipse cx={34} cy={28} rx={3} ry={4} fill={GOLD} {...s} strokeWidth={1.4} />
    </>
  ),
  hoankiem: () => (
    <>
      <Water y={30} />
      <rect x={16} y={20} width={16} height={10} fill={PAPER} {...s} />
      <rect x={19} y={13} width={10} height={7} fill={PAPER} {...s} />
      <rect x={21} y={8} width={6} height={5} fill={PAPER} {...s} />
      <path d="M20 8 L24 4 L28 8" fill={RED} {...s} />
      <path d="M21 30 v-5 a3 3 0 0 1 6 0 v5" fill={INK} />
      <path d="M8 40 q4 -3 8 0" fill={GREEN} {...s} strokeWidth={1.4} />
    </>
  ),
  gate: () => (
    <>
      <rect x={6} y={18} width={36} height={24} fill={PAPER} {...s} />
      <path d="M18 42 v-12 a6 6 0 0 1 12 0 v12" fill={INK} />
      <rect x={10} y={10} width={28} height={8} fill={BROWN} {...s} />
      <path d="M6 10 Q24 0 42 10" fill={RED} {...s} />
      <Hatch x={7} y={19} w={10} h={22} gap={4} />
      <Hatch x={31} y={19} w={10} h={22} gap={4} />
    </>
  ),
  jail: () => (
    <>
      <rect x={4} y={14} width={40} height={6} fill={PAPER} {...s} />
      {[4, 12, 20, 28, 36].map((x) => (
        <rect key={x} x={x} y={14} width={4} height={6} fill={RED} />
      ))}
      <line x1={8} y1={20} x2={8} y2={42} {...s} />
      <circle cx={20} cy={38} r={4} fill={PAPER} {...s} />
      <circle cx={36} cy={38} r={4} fill={PAPER} {...s} />
      <path d="M20 38 L26 30 L34 30 L36 38 M26 30 L24 26 L28 26" fill="none" {...s} />
      <path d="M24 30 h10 v4 h-8 Z" fill={INDIGO} {...s} />
    </>
  ),
  vanmieu: () => (
    <>
      <rect x={8} y={30} width={32} height={12} fill={PAPER} {...s} />
      <path d="M18 42 v-6 a6 6 0 0 1 12 0 v6" fill={INK} />
      <rect x={14} y={16} width={20} height={12} fill={RED} {...s} />
      <circle cx={24} cy={22} r={4} fill={GOLD} {...s} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={24} y1={18} x2={24 + Math.cos((i * Math.PI) / 2) * 0} y2={26} stroke={INK} strokeWidth={0.8} />
      ))}
      <path d="M8 30 Q24 24 40 30" fill={BROWN} {...s} />
      <path d="M10 16 Q24 8 38 16" fill={BROWN} {...s} />
    </>
  ),
  police: () => (
    <>
      <path d="M10 22 Q24 8 38 22 Z" fill={GOLD} {...s} />
      <rect x={8} y={22} width={32} height={5} fill={INDIGO} {...s} />
      <circle cx={24} cy={16} r={3} fill={RED} {...s} strokeWidth={1.4} />
      <path d="M16 36 h14 a6 6 0 1 1 -2 4 h-12 Z" fill={PAPER} {...s} />
      <path d="M34 34 q4 -4 8 -2" fill="none" {...s} />
    </>
  ),
  bus: () => (
    <>
      <rect x={4} y={14} width={40} height={22} rx={4} fill={GREEN} {...s} />
      {[8, 18, 28].map((x) => (
        <rect key={x} x={x} y={18} width={8} height={7} fill={SKY} {...s} strokeWidth={1.4} />
      ))}
      <rect x={38} y={18} width={4} height={10} fill={PAPER} {...s} strokeWidth={1.4} />
      <circle cx={13} cy={38} r={4} fill={INK} />
      <circle cx={35} cy={38} r={4} fill={INK} />
    </>
  ),
  metro: () => (
    <>
      <path d="M2 18 L46 18" {...s} />
      <rect x={6} y={20} width={36} height={16} rx={6} fill={PINK} {...s} />
      <rect x={10} y={23} width={10} height={6} fill={SKY} {...s} strokeWidth={1.4} />
      <rect x={28} y={23} width={10} height={6} fill={SKY} {...s} strokeWidth={1.4} />
      <path d="M4 42 L44 42 M10 36 L8 42 M38 36 L40 42" {...s} />
    </>
  ),
  train: () => (
    <>
      <rect x={14} y={14} width={26} height={20} fill={RED} {...s} />
      <rect x={6} y={22} width={10} height={12} fill={INK} />
      <rect x={30} y={8} width={6} height={6} fill={INK} />
      <rect x={18} y={18} width={8} height={7} fill={SKY} {...s} strokeWidth={1.4} />
      {[12, 24, 36].map((x) => (
        <circle key={x} cx={x} cy={38} r={4} fill={PAPER} {...s} />
      ))}
      <path d="M2 43 L46 43" {...s} />
    </>
  ),
  plane: () => (
    <>
      <path d="M6 26 L40 22 Q46 22 44 26 L40 28 L6 28 Z" fill={PAPER} {...s} />
      <path d="M20 26 L14 12 L20 12 L30 25 Z" fill={INDIGO} {...s} />
      <path d="M20 28 L16 38 L21 38 L28 28 Z" fill={INDIGO} {...s} />
      <path d="M6 26 L4 18 L8 18 L12 25 Z" fill={RED} {...s} />
    </>
  ),
  power: () => (
    <>
      <circle cx={24} cy={24} r={18} fill={GOLD} {...s} />
      <path d="M26 8 L14 26 L23 26 L20 40 L34 20 L25 20 Z" fill={RED} {...s} />
    </>
  ),
  water: () => (
    <>
      <path d="M24 4 Q40 24 36 32 A12 12 0 0 1 12 32 Q8 24 24 4 Z" fill={SKY} {...s} />
      <path d="M17 30 a7 7 0 0 0 6 6" fill="none" stroke={PAPER} strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
  chance: () => (
    <>
      <rect x={10} y={4} width={28} height={40} rx={3} fill={RED} {...s} />
      <text x={24} y={33} textAnchor="middle" fontSize={26} fontWeight={700} fill={PAPER} stroke={INK} strokeWidth={1}>
        ?
      </text>
    </>
  ),
  community: () => (
    <>
      <rect x={8} y={10} width={32} height={30} rx={2} fill={RED} {...s} />
      <path d="M8 18 L40 18" {...s} />
      <circle cx={24} cy={29} r={7} fill={GOLD} {...s} />
      <rect x={21.5} y={26.5} width={5} height={5} fill={RED} {...s} strokeWidth={1.2} />
    </>
  ),
  event: () => <Drum />,
  tax: () => (
    <>
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx={20 + i * 3} cy={36 - i * 7} rx={13} ry={5} fill={GOLD} {...s} />
      ))}
      <rect x={21} y={14} width={4} height={4} fill={INK} transform="rotate(45 23 16)" />
    </>
  ),
  parking: () => (
    <>
      <rect x={10} y={6} width={28} height={28} rx={4} fill={INDIGO} {...s} />
      <text x={24} y={28} textAnchor="middle" fontSize={20} fontWeight={700} fill={PAPER}>
        P
      </text>
      <line x1={24} y1={34} x2={24} y2={44} {...s} />
    </>
  ),
};

/** Trống đồng — concentric rings with a star, used for Hanoi Event. */
export function Drum({ color = INDIGO }: { color?: string }) {
  return (
    <>
      <circle cx={24} cy={24} r={20} fill={color} {...s} />
      <circle cx={24} cy={24} r={14} fill="none" stroke={GOLD} strokeWidth={1.5} />
      <circle cx={24} cy={24} r={9} fill="none" stroke={GOLD} strokeWidth={1} strokeDasharray="2 2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return (
          <line key={i} x1={24} y1={24} x2={24 + Math.cos(a) * 7} y2={24 + Math.sin(a) * 7} stroke={GOLD} strokeWidth={1.4} />
        );
      })}
      <circle cx={24} cy={24} r={2.5} fill={GOLD} />
    </>
  );
}

export function TileIcon({ kind, size = '100%' }: { kind: string; size?: number | string }) {
  const Icon = TILE_ICONS[kind];
  if (!Icon) return null;
  return (
    <Svg size={size} className="tile-icon">
      <Icon />
    </Svg>
  );
}

// ---------------------------------------------------------------- characters

const AVATARS: Record<string, { bg: string; draw: () => JSX.Element }> = {
  C01: {
    bg: GOLD,
    draw: () => (
      <>
        <circle cx={24} cy={28} r={10} fill={PINK} {...s} />
        <path d="M14 18 L16 8 L21 14 L24 6 L27 14 L32 8 L34 18 Z" fill={GOLD} {...s} />
        <circle cx={20} cy={27} r={1.3} fill={INK} />
        <circle cx={28} cy={27} r={1.3} fill={INK} />
        <path d="M20 32 q4 3 8 0" fill="none" {...s} strokeWidth={1.5} />
      </>
    ),
  },
  C02: {
    bg: INDIGO,
    draw: () => (
      <>
        <path d="M12 26 a12 12 0 0 1 24 0 v4 h-24 Z" fill={RED} {...s} />
        <rect x={13} y={28} width={22} height={8} rx={3} fill={INK} />
        <rect x={16} y={24} width={16} height={4} fill={SKY} {...s} strokeWidth={1.4} />
        <circle cx={20} cy={26} r={1} fill={INK} />
        <circle cx={28} cy={26} r={1} fill={INK} />
      </>
    ),
  },
  C03: {
    bg: PAPER,
    draw: () => (
      <>
        <path d="M11 26 a13 12 0 0 1 26 0 v3 h-26 Z" fill={GREEN} {...s} />
        <path d="M11 29 h26" {...s} />
        <circle cx={24} cy={33} r={7} fill={PINK} {...s} />
        <circle cx={21} cy={32} r={1} fill={INK} />
        <circle cx={27} cy={32} r={1} fill={INK} />
        <path d="M22 16 h4" stroke={PAPER} strokeWidth={2} />
      </>
    ),
  },
  C04: {
    bg: PINK,
    draw: () => (
      <>
        <rect x={16} y={8} width={16} height={30} rx={3} fill={INK} {...s} />
        <rect x={18} y={11} width={12} height={22} fill={PAPER} />
        <path d="M24 28 l-5 -5 a3 3 0 0 1 5 -4 a3 3 0 0 1 5 4 Z" fill={RED} {...s} strokeWidth={1.2} />
        <circle cx={24} cy={35.5} r={1.2} fill={PAPER} />
      </>
    ),
  },
  C05: {
    bg: GREEN,
    draw: () => (
      <>
        <path d="M8 36 L18 30 L28 34 L40 28 L40 40 L8 40 Z" fill={GOLD} {...s} />
        <line x1={24} y1={32} x2={24} y2={10} {...s} />
        <path d="M24 10 L36 14 L24 18 Z" fill={RED} {...s} />
        <text x={30} y={16} fontSize={5} fill={PAPER} fontWeight={700} textAnchor="middle">
          ₫
        </text>
      </>
    ),
  },
  C06: {
    bg: '#5B3A6E',
    draw: () => (
      <>
        <rect x={10} y={14} width={12} height={20} rx={2} fill={PAPER} {...s} transform="rotate(-15 16 24)" />
        <rect x={26} y={14} width={12} height={20} rx={2} fill={PAPER} {...s} transform="rotate(15 32 24)" />
        <rect x={18} y={11} width={12} height={22} rx={2} fill={GOLD} {...s} />
        <path d="M24 16 l1.5 3.5 3.5 .5 -2.5 2.5 .7 3.5 -3.2 -1.8 -3.2 1.8 .7 -3.5 -2.5 -2.5 3.5 -.5 Z" fill={RED} />
      </>
    ),
  },
  C07: {
    bg: RED,
    draw: () => (
      <>
        <circle cx={24} cy={30} r={9} fill={PINK} {...s} />
        <path d="M8 18 L24 11 L40 18 L24 25 Z" fill={INK} {...s} />
        <path d="M16 21 v5 q8 4 16 0 v-5" fill={INK} />
        <path d="M38 18 v8" stroke={GOLD} strokeWidth={2} />
        <circle cx={38} cy={27} r={1.6} fill={GOLD} />
      </>
    ),
  },
  C08: {
    bg: SKY,
    draw: () => (
      <>
        <rect x={10} y={20} width={28} height={18} rx={3} fill={BROWN} {...s} />
        <path d="M19 20 v-4 h10 v4" fill="none" {...s} />
        <path d="M10 27 h28" {...s} />
        <rect x={21} y={25} width={6} height={5} fill={GOLD} {...s} strokeWidth={1.4} />
        <path d="M24 6 l3 6 -3 8 -3 -8 Z" fill={RED} {...s} strokeWidth={1.4} />
      </>
    ),
  },
};

export function Avatar({ character, size = 40, label }: { character: string | null; size?: number | string; label?: string }) {
  const a = character ? AVATARS[character] : undefined;
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="avatar" role="img" aria-label={label}>
      <circle cx={24} cy={24} r={22} fill={a?.bg ?? PAPER} stroke={INK} strokeWidth={2.5} />
      <circle cx={24} cy={24} r={18.5} fill="none" stroke={INK} strokeWidth={0.8} />
      {a ? a.draw() : <text x={24} y={30} textAnchor="middle" fontSize={16} fontWeight={700} fill={INK}>{label?.[0]?.toUpperCase() ?? '?'}</text>}
    </svg>
  );
}

export const AVATAR_IDS = Object.keys(AVATARS);

// ---------------------------------------------------------------- buildings & cards

/** Nhà ống mái ngói. */
export function House({ size = 12, color = RED }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 12 14" width={size} height={size * (14 / 12)} className="house" aria-hidden>
      <rect x={2} y={5} width={8} height={8.5} fill={PAPER} stroke={INK} strokeWidth={1} />
      <path d="M1 5.5 L6 1 L11 5.5 Z" fill={color} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
      <rect x={5} y={9} width={2} height={4.5} fill={BROWN} />
    </svg>
  );
}

/** Tòa cao tầng. */
export function Hotel({ size = 14, color = INDIGO }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 12 18" width={size * (12 / 18) * 1.4} height={size * 1.4} className="hotel" aria-hidden>
      <rect x={2} y={2} width={8} height={15.5} fill={color} stroke={INK} strokeWidth={1} />
      {[4.5, 7.5, 10.5, 13.5].map((y) => (
        <line key={y} x1={3.5} y1={y} x2={8.5} y2={y} stroke={GOLD} strokeWidth={1} />
      ))}
      <path d="M2 2 L6 0.5 L10 2" fill={RED} stroke={INK} strokeWidth={0.8} />
    </svg>
  );
}

export function CardBack({ deck, size = 48 }: { deck: 'chance' | 'community' | 'event'; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className="card-back" aria-hidden>
      {deck === 'event' ? (
        <Drum />
      ) : (
        <>
          <rect x={4} y={4} width={40} height={40} rx={4} fill={deck === 'chance' ? RED : GOLD} stroke={INK} strokeWidth={2} />
          <rect x={8} y={8} width={32} height={32} rx={2} fill="none" stroke={deck === 'chance' ? GOLD : RED} strokeWidth={1.2} />
          {deck === 'chance' ? (
            <text x={24} y={33} textAnchor="middle" fontSize={24} fontWeight={700} fill={PAPER}>
              ?
            </text>
          ) : (
            <path d="M24 14 q6 6 0 14 q-6 -8 0 -14 M16 22 q6 2 8 8 q-8 0 -8 -8 M32 22 q-6 2 -8 8 q8 0 8 -8" fill={RED} stroke={INK} strokeWidth={1} />
          )}
        </>
      )}
    </svg>
  );
}
