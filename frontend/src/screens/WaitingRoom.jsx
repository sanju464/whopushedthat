import { useState } from 'react';

export default function WaitingRoom({ username, room, socket, onLeave }) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const isHost = room && socket.id === room.hostId;
  const players = room?.players || [];
  const connectedPlayers = players.filter(p => p.isConnected !== false);

  const handleStart = () => {
    if (connectedPlayers.length < 3) {
      setError('Need at least 3 players to start.');
      return;
    }
    setError('');
    setStarting(true);
    socket.emit('start-game', { code: room.code }, (res) => {
      setStarting(false);
      if (res.error) setError(res.error);
    });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room?.code || '');
  };

  return (
    <div className="screen-center grid-bg" style={{ padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '520px', animation: 'slide-up 0.4s ease' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--neon-green-dim)',
            letterSpacing: '0.3em',
            marginBottom: '8px',
          }}>
            STAGING AREA
          </div>
          <h2 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '1.6rem',
            color: 'var(--text-primary)',
            marginBottom: '4px',
          }}>
            WAITING ROOM
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
            {isHost ? 'You are the host. Start when ready.' : 'Waiting for host to start...'}
          </p>
        </div>

        {/* Room code card */}
        <div className="card" style={{
          marginBottom: '16px',
          background: 'rgba(0,255,136,0.03)',
          border: '1px solid var(--border-green)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.2em',
            marginBottom: '8px',
          }}>
            ROOM CODE
          </div>
          <div style={{
            fontFamily: 'var(--font-title)',
            fontSize: '2.5rem',
            fontWeight: 900,
            color: 'var(--neon-green)',
            letterSpacing: '0.4em',
            textShadow: '0 0 20px rgba(0,255,136,0.4)',
            marginBottom: '12px',
          }}>
            {room?.code}
          </div>
          <button
            id="copy-code-btn"
            className="btn btn-ghost btn-sm"
            onClick={copyCode}
          >
            ⊕ Copy Code
          </button>
        </div>

        {/* Players list */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--neon-green-dim)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              Operatives
            </span>
            <span className="badge badge-green">
              {connectedPlayers.length} / 6
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {players.map((player, idx) => (
              <div key={player.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: player.isConnected === false
                  ? 'rgba(255,255,255,0.02)'
                  : player.id === room?.hostId
                    ? 'rgba(0,255,136,0.06)'
                    : 'rgba(255,255,255,0.03)',
                border: player.id === room?.hostId
                  ? '1px solid rgba(0,255,136,0.15)'
                  : '1px solid transparent',
                opacity: player.isConnected === false ? 0.4 : 1,
                animation: `slide-in-right 0.3s ease ${idx * 0.05}s both`,
              }}>
                {/* Avatar circle */}
                <div style={{
                  width: '32px', height: '32px',
                  borderRadius: '50%',
                  background: `hsl(${(player.username.charCodeAt(0) * 47) % 360}, 60%, 40%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {player.username[0].toUpperCase()}
                </div>

                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  color: player.username === username ? 'var(--neon-green)' : 'var(--text-primary)',
                  flex: 1,
                }}>
                  {player.username}
                  {player.username === username && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '6px' }}>(you)</span>
                  )}
                </span>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {player.id === room?.hostId && (
                    <span className="badge badge-yellow">HOST</span>
                  )}
                  {player.isConnected === false && (
                    <span className="badge badge-red">OFFLINE</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {players.length < 3 && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(255,204,0,0.05)',
              border: '1px dashed rgba(255,204,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--neon-yellow)',
              letterSpacing: '0.08em',
            }}>
              ⚠ Need {3 - players.length} more player{3 - players.length !== 1 ? 's' : ''} to start
            </div>
          )}
        </div>

        {/* Category selection preview */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--neon-green-dim)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}>
            Select Category
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(0,255,136,0.06)',
              border: '1px solid var(--border-green)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <span style={{ fontSize: '1.2rem' }}></span>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-green)', fontSize: '0.85rem' }}>
                  Cryptography
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                  Caesar, Vigenère, Binary, Hex, Morse
                </div>
              </div>
              <span className="badge badge-green" style={{ marginLeft: 'auto' }}>ACTIVE</span>
            </div>
            {['Forensics', 'Network Analysis', 'Reverse Engineering'].map(cat => (
              <div key={cat} style={{
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: 0.4,
              }}>
                <span style={{ fontSize: '1.2rem' }}></span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {cat}
                </span>
                <span className="badge" style={{
                  marginLeft: 'auto',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  SOON
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        {error && <div className="error-msg" style={{ marginBottom: '12px' }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-ghost" onClick={onLeave} style={{ flex: '0 0 auto' }}>
            ← Leave
          </button>
          {isHost && (
            <button
              id="start-game-btn"
              className="btn btn-primary btn-full"
              onClick={handleStart}
              disabled={starting || connectedPlayers.length < 3}
              style={{ flex: 1 }}
            >
              {starting ? '[ INITIATING... ]' : '[ LAUNCH OPERATION ]'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
