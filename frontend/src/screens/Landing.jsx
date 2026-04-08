import { useState } from 'react';
import socket from '../socket';
import styles from './Landing.module.css';

export default function Landing({ onRoomCreated, onRoomJoined }) {
  const [mode, setMode] = useState(null); // 'create' | 'join'
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = () => {
    if (!username.trim()) { setError('Enter a username first.'); return; }
    setError('');
    setLoading(true);
    socket.emit('create-room', { username: username.trim() }, (res) => {
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      onRoomCreated(res.room, username.trim());
    });
  };

  const handleJoin = () => {
    if (!username.trim()) { setError('Enter a username.'); return; }
    if (roomCode.trim().length !== 5) { setError('Room code must be 5 characters.'); return; }
    setError('');
    setLoading(true);
    socket.emit('join-room', { code: roomCode.trim().toUpperCase(), username: username.trim() }, (res) => {
      setLoading(false);
      if (res.error) { setError(res.error); return; }
      onRoomJoined(res.room, username.trim());
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (mode === 'create') handleCreate();
      if (mode === 'join') handleJoin();
    }
  };

  return (
    <div className="screen-center grid-bg" style={{ padding: '24px' }}>
      {/* Decorative background glow */}
      <div style={{
        position: 'fixed', top: '20%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px', height: '600px',
        background: 'radial-gradient(circle, rgba(0,255,136,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '440px', animation: 'slide-up 0.5s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--neon-green-dim)',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            &gt; INITIALIZING PROTOCOL...
          </div>

          {/* Main title */}
          <h1 className="title-flicker" style={{
            fontFamily: 'var(--font-title)',
            fontSize: 'clamp(1.8rem, 6vw, 2.9rem)',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
            marginBottom: '0',
          }}>
            whopushedthat
          </h1>
          <h1 className="title-flicker" style={{
            fontFamily: 'var(--font-title)',
            fontSize: 'clamp(1.8rem, 6vw, 2.9rem)',
            fontWeight: 900,
            background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
            marginBottom: '10px',
          }}>

          </h1>

          {/* Subtitle — "still debugging..." in Minecraft-edition style */}
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            fontStyle: 'italic',
            color: 'var(--neon-green-dim)',
            opacity: 0.65,
            letterSpacing: '0.08em',
            marginBottom: '14px',
          }}>
            still debugging...
          </p>

          <p style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            fontSize: '0.8rem',
            letterSpacing: '0.15em',
          }}>
            SOCIAL DEDUCTION · CRYPTOGRAPHY · BETRAYAL
          </p>
        </div>

        {/* Main card */}
        <div className="card-glow" style={{ position: 'relative' }}>
          {/* Username input — always visible */}
          <div style={{ marginBottom: '20px' }}>
            <label className="label">Your Callsign</label>
            <input
              id="username-input"
              className="input"
              placeholder="Enter your username..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={20}
              autoFocus
            />
          </div>

          {/* Mode selector */}
          {!mode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                id="create-room-btn"
                className="btn btn-primary btn-full btn-lg"
                onClick={() => {
                  if (!username.trim()) { setError('Enter a username first.'); return; }
                  setError(''); setMode('create');
                }}
              >
                <span>⊕</span> Create Room
              </button>
              <button
                id="join-room-btn"
                className="btn btn-ghost btn-full btn-lg"
                onClick={() => {
                  if (!username.trim()) { setError('Enter a username first.'); return; }
                  setError(''); setMode('join');
                }}
              >
                <span>⊞</span> Join Room
              </button>
            </div>
          ) : mode === 'create' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: 'rgba(0,255,136,0.05)',
                border: '1px solid var(--border-green)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}>
                <div style={{ color: 'var(--neon-green)', marginBottom: '4px' }}>▸ Create New Room</div>
                Share the room code with 2–5 friends to start.
                As host, you control the game.
              </div>
              <button
                id="confirm-create-btn"
                className="btn btn-primary btn-full"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? '[ CREATING... ]' : '[ DEPLOY ROOM ]'}
              </button>
              <button className="btn btn-ghost btn-full btn-sm" onClick={() => { setMode(null); setError(''); }}>
                ← Back
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label">Room Code</label>
                <input
                  id="room-code-input"
                  className="input input-lg"
                  placeholder="XXXXX"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase().slice(0, 5))}
                  onKeyDown={handleKeyDown}
                  maxLength={5}
                  autoFocus
                />
              </div>
              <button
                id="confirm-join-btn"
                className="btn btn-primary btn-full"
                onClick={handleJoin}
                disabled={loading || roomCode.length !== 5}
              >
                {loading ? '[ CONNECTING... ]' : '[ JOIN OPERATION ]'}
              </button>
              <button className="btn btn-ghost btn-full btn-sm" onClick={() => { setMode(null); setRoomCode(''); setError(''); }}>
                ← Back
              </button>
            </div>
          )}

          {error && <div className="error-msg" style={{ marginTop: '12px' }}>⚠ {error}</div>}
        </div>

        {/* Footer info */}
        <div style={{
          textAlign: 'center',
          marginTop: '32px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          letterSpacing: '0.1em',
        }}>
          3–6 PLAYERS · SOLVE CRYPTO PUZZLES · FIND THE IMPOSTER
        </div>
      </div>
    </div>
  );
}
