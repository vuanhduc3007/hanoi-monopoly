import { useState } from 'react';
import { TutorialSetting } from '../components/Coach';
import { Modal } from '../components/Modal';
import { t } from '../i18n/vi';
import { createRoom, joinRoom, savedName } from '../net/connection';
import { useStore } from '../store';

/** S1 — create a room, join by code (or invite link ?room=CODE), how to play. */
export function Home() {
  const conn = useStore((s) => s.conn);
  const invite = new URLSearchParams(location.search).get('room') ?? '';
  const [name, setName] = useState(savedName());
  const [code, setCode] = useState(invite.toUpperCase());
  const [donate, setDonate] = useState(false);
  const busy = conn === 'connecting' || conn === 'reconnecting';
  return (
    <main className="home">
      <h1>{t.appTitle}</h1>
      <p className="tagline">{t.tagline}</p>
      <div className="panel home-form">
        <label>
          {t.home.yourName}
          <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <button className="primary" disabled={busy} onClick={() => createRoom(name)}>
          {t.home.create}
        </button>
        <div className="divider" />
        <label>
          {t.home.joinCode}
          <input
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="code-input"
            placeholder="ABC234"
          />
        </label>
        <div className="buttons">
          <button className="primary" disabled={busy || code.length < 6} onClick={() => joinRoom(code, name)}>
            {t.home.join}
          </button>
          <button disabled={busy || code.length < 6} onClick={() => joinRoom(code, name, true)}>
            {t.home.watch}
          </button>
        </div>
        <TutorialSetting label={t.tutorial.homeToggle} />
        {busy && <p className="muted">{conn === 'reconnecting' ? t.home.reconnecting : t.home.connecting}</p>}
      </div>
      <details className="panel howto">
        <summary>{t.home.howTo}</summary>
        <ul>
          {t.home.howToText.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      <button className="link donate-link" onClick={() => setDonate(true)}>
        {t.donate.button}
      </button>
      {donate && (
        <Modal title={t.donate.title} onClose={() => setDonate(false)}>
          <p>{t.donate.body}</p>
          <img className="donate-qr" src={`${import.meta.env.BASE_URL}donate-qr.png`} alt={t.donate.qrAlt} />
        </Modal>
      )}
    </main>
  );
}
