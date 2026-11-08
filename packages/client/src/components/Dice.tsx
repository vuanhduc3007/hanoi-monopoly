const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[6, 6], [12, 12], [18, 18]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[6, 6], [18, 6], [12, 12], [6, 18], [18, 18]],
  6: [[7, 6], [17, 6], [7, 12], [17, 12], [7, 18], [17, 18]],
};

/** Woodcut dice: paper face, ink border, red pip for one (bát xúc xắc style). */
export function Die({ value, size = 40 }: { value: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="die" role="img" aria-label={String(value)}>
      <rect x={1.5} y={1.5} width={21} height={21} rx={4} fill="#fffaf0" stroke="#2B2522" strokeWidth={1.8} />
      {(PIPS[value] ?? []).map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={value === 1 ? 3.2 : 2.2} fill={value === 1 ? '#B8312F' : '#2B2522'} />
      ))}
    </svg>
  );
}

export function Dice({ dice }: { dice: number[] | null }) {
  if (!dice) return <div className="dice muted" aria-hidden />;
  return (
    <div className="dice" key={dice.join('-')} aria-label={dice.join(' + ')}>
      {dice.map((d, i) => (
        <Die key={i} value={d} />
      ))}
    </div>
  );
}
