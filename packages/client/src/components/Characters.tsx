import type { PlayerState, PublicState } from '@hanoi-monopoly/engine';
import { Avatar } from '../art/icons';
import { boardNote, describeCharacter, t } from '../i18n/vi';
import { D } from '../lib/gameData';
import { colorOf, nameOf } from '../lib/selectors';
import type { RoomView } from '../net/protocol';
import { Modal } from './Modal';

/** Read every character's passives, drawbacks and skill as they play in this game (board and table size). */
export function Characters({ state, room, onClose }: { state: PublicState; room: RoomView; onClose: () => void }) {
  const players = state.players.length;
  const inGame = state.players.filter((p) => p.character);
  const others = Object.keys(D.characters).filter((id) => !inGame.some((p) => p.character === id));
  const note = boardNote();
  return (
    <Modal title={t.characters.title} onClose={onClose} wide>
      {!state.config.characters && <p className="muted">{t.characters.off}</p>}
      {note && <p className="table-note">{note}</p>}
      <div className="char-list">
        {inGame.map((p) => (
          <CharacterCard key={p.id} id={p.character!} players={players} player={p} room={room} />
        ))}
      </div>
      {state.config.characters && others.length > 0 && (
        <details className="char-others">
          <summary>{t.characters.others}</summary>
          <div className="char-list">
            {others.map((id) => (
              <CharacterCard key={id} id={id} players={players} room={room} />
            ))}
          </div>
        </details>
      )}
    </Modal>
  );
}

function CharacterCard({ id, players, player, room }: { id: string; players: number; player?: PlayerState; room: RoomView }) {
  const c = describeCharacter(id, players);
  const status = player
    ? player.skillUsed
      ? player.skillCooldown
        ? t.characters.cooldown(player.skillCooldown)
        : t.characters.usedForGood
      : t.characters.ready
    : null;
  return (
    <article className="character char-card" style={player ? { borderColor: colorOf(room, player.id) } : undefined}>
      <header className="character-head">
        <Avatar character={id} size={44} label={c.name} />
        <h3>
          {c.name}
          {player && <span className="muted"> · {nameOf(room, player.id)}</span>}
        </h3>
      </header>
      {c.tableNote && <p className="table-note">{c.tableNote}</p>}
      <h4>{t.pick.passive}</h4>
      <ul>
        {c.passives.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h4>{t.pick.drawback}</h4>
      <ul>
        {c.drawbacks.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <h4>{t.pick.skill}</h4>
      <p>{c.skill}</p>
      {status && <p className={player?.skillUsed ? 'muted' : 'ok'}>{status}</p>}
    </article>
  );
}
