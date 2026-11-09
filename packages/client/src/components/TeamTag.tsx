import { teamName } from '../i18n/vi';
import { TEAM_COLORS } from '../lib/board';

/** Small coloured chip naming a team ("Đội Rồng"). */
export function TeamTag({ team, short = false }: { team: number | null | undefined; short?: boolean }) {
  if (team === null || team === undefined) return null;
  const color = TEAM_COLORS[team % TEAM_COLORS.length];
  return (
    <span className="tag team-tag" style={{ background: color, borderColor: color }}>
      {short ? teamName(team).replace(/^Đội /, '') : teamName(team)}
    </span>
  );
}
