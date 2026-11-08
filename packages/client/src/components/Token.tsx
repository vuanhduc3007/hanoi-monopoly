import { Avatar } from '../art/icons';

/** A player's piece: the character portrait (or initial) with the player's colour ring. */
export function Token({
  character,
  name,
  color,
  size = 22,
  className = '',
}: {
  character: string | null;
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`token ${className}`} style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}` }} title={name}>
      <Avatar character={character} size={size} label={name} />
    </span>
  );
}
