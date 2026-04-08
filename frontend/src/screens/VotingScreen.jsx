import { useState, useEffect, useRef } from 'react';

export default function VotingScreen({ username, room, socket, myRole, voteResult, votes, wrongAnswers, voteEndTime, messages = [] }) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);
  const isHost = socket.id === room?.hostId;

  const activePlayers = room?.players?.filter(p =>
    p.isConnected !== false && !room.eliminatedPlayers?.includes(p.id)
  ) || [];

  // Count votes per player
  const voteCounts = {};
  activePlayers.forEach(p => { voteCounts[p.id] = 0; });
  Object.values(votes).forEach(targetId => {
    if (voteCounts[targetId] !== undefined) voteCounts[targetId]++;
  });

  const totalVoters = activePlayers.length;
  const votedCount = Object.keys(votes).length;
  const skipCount = Object.values(votes).filter(v => v === '__skip__').length;

  // Countdown timer synced with backend
  useEffect(() => {
    if (voteResult || !voteEndTime) return; // Already resolved
    const interval = setInterval(() => {
      const remainingCalc = Math.max(0, Math.floor((voteEndTime - Date.now()) / 1000));
      setTimeLeft(remainingCalc);
      
      if (remainingCalc <= 0) {
        clearInterval(interval);
        if (isHost && !voteResult) {
          socket.emit('resolve-votes', { code: room.code });
        }
      }
    }, 500); // Evaluate twice a second to be more responsive to exact timestamps
    return () => clearInterval(interval);
  }, [voteResult, voteEndTime, isHost, room?.code, socket]);

  const castVote = (targetId) => {
    if (hasVoted) return;
    setSelectedTarget(targetId);
    setHasVoted(true);
    socket.emit('cast-vote', { code: room.code, targetId });
  };

  const skipVote = () => {
    if (hasVoted) return;
    setSelectedTarget('__skip__');
    setHasVoted(true);
    socket.emit('cast-vote', { code: room.code, targetId: null });
  };

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    socket.emit('send-message', { code: room.code, message: chatInput.trim(), username });
    setChatInput('');
  };

  const handleChatKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const forceResolve = () => {
    socket.emit('resolve-votes', { code: room.code });
  };

  const myVote = votes[socket.id];

  return (
    <div className="screen-center grid-bg" style={{ padding: '24px', alignItems: 'flex-start' }}>
      {/* Red ambient glow */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '700px', height: '700px',
        background: 'radial-gradient(circle, rgba(255,56,100,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '960px',
        display: 'flex',
        gap: '20px',
        alignItems: 'flex-start',
        animation: 'slide-up 0.4s ease',
      }}>
        {/* Left Column - Voting */}
        <div style={{ flex: 1 }}>
          {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--neon-red)',
            letterSpacing: '0.3em',
            marginBottom: '8px',
          }}>
            ⚠ WRONG ANSWER DETECTED
          </div>
          <h2 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '2rem',
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            VOTE TO ELIMINATE
          </h2>
          <p style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            fontSize: '0.78rem',
          }}>
            Who is the Imposter? Choose wisely.
          </p>
        </div>

        {/* Timer + vote progress */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '10px 16px',
          background: 'rgba(255,56,100,0.05)',
          border: '1px solid var(--border-red)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--neon-red)' }}>
            ⏱ {timeLeft}s remaining
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {votedCount}/{totalVoters} voted{skipCount > 0 ? ` · ${skipCount} skipped` : ''}
          </div>

          {/* Wrong answer meter */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: i <= wrongAnswers ? 'var(--neon-red)' : 'var(--border-subtle)',
                boxShadow: i <= wrongAnswers ? '0 0 6px var(--neon-red)' : 'none',
              }} />
            ))}
          </div>
        </div>

        {/* Player vote list */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '14px',
          }}>
            Select Suspect
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activePlayers.map((player) => {
              const isSelf = player.id === socket.id;
              const isVoted = selectedTarget === player.id || myVote === player.id;
              const voteCount = voteCounts[player.id] || 0;
              const hasOthersVoted = voteCount > 0;

              return (
                <button
                  key={player.id}
                  id={`vote-${player.id}`}
                  onClick={() => !isSelf && castVote(player.id)}
                  disabled={hasVoted || isSelf}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    background: isVoted
                      ? 'rgba(255,56,100,0.1)'
                      : hasOthersVoted
                        ? 'rgba(255,204,0,0.05)'
                        : 'rgba(255,255,255,0.03)',
                    border: isVoted
                      ? '1px solid var(--border-red)'
                      : hasOthersVoted
                        ? '1px solid rgba(255,204,0,0.2)'
                        : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: hasVoted || isSelf ? 'not-allowed' : 'pointer',
                    opacity: isSelf ? 0.4 : 1,
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={e => {
                    if (!hasVoted && !isSelf) {
                      e.currentTarget.style.background = 'rgba(255,56,100,0.07)';
                      e.currentTarget.style.borderColor = 'rgba(255,56,100,0.3)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!hasVoted && !isSelf) {
                      e.currentTarget.style.background = hasOthersVoted ? 'rgba(255,204,0,0.05)' : 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = hasOthersVoted ? 'rgba(255,204,0,0.2)' : 'var(--border-subtle)';
                    }
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '36px', height: '36px',
                    borderRadius: '50%',
                    background: `hsl(${(player.username.charCodeAt(0) * 47) % 360}, 55%, 35%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 'bold',
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {player.username[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.88rem',
                      color: isSelf ? 'var(--text-muted)' : isVoted ? 'var(--neon-red)' : 'var(--text-primary)',
                    }}>
                      {player.username}
                      {isSelf && ' (you — cannot vote self)'}
                    </div>
                    {/* Vote bar */}
                    {voteCount > 0 && (
                      <div style={{
                        marginTop: '4px',
                        height: '3px',
                        background: 'var(--border-subtle)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${(voteCount / totalVoters) * 100}%`,
                          background: 'var(--neon-red)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {voteCount > 0 && (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        color: 'var(--neon-red)',
                      }}>
                        {voteCount} vote{voteCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {isVoted && (
                      <span style={{ color: 'var(--neon-red)', fontSize: '1rem' }}>✓</span>
                    )}
                    {player.id === room?.hostId && (
                      <span className="badge badge-yellow" style={{ fontSize: '0.6rem' }}>HOST</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {!hasVoted && (
          <button
            id="skip-vote-btn"
            onClick={skipVote}
            style={{
              width: '100%',
              padding: '10px 16px',
              marginBottom: '12px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            — skip vote —
          </button>
        )}

        {hasVoted && selectedTarget === '__skip__' && (
          <div className="success-msg" style={{ marginBottom: '12px' }}>
            ↷ Vote skipped. Waiting for others...
          </div>
        )}

        {hasVoted && selectedTarget !== '__skip__' && (
          <div className="success-msg" style={{ marginBottom: '12px' }}>
            ✓ Vote cast. Waiting for others...
          </div>
        )}

        {/* Host force-resolve */}
        {isHost && (
          <button
            id="force-resolve-btn"
            className="btn btn-danger btn-full btn-sm"
            onClick={forceResolve}
          >
            Force Resolve Votes Now
          </button>
        )}
      </div>

      {/* ── Chat Panel ──────────────────────────────────── */}
      <div style={{
        flex: '0 0 300px',
        display: 'flex',
        flexDirection: 'column',
        height: '520px',
        background: 'var(--surface-dark)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
      }}>
        {/* Chat header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          Discussion
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {messages.length === 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              marginTop: '12px',
              opacity: 0.7,
            }}>
              Discuss before you vote...
            </div>
          )}
          {messages.map((msg) => {
            const isMine = msg.username === username;
            return (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMine ? 'flex-end' : 'flex-start',
              }}>
                {!isMine && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    color: 'var(--text-muted)',
                    marginBottom: '2px',
                  }}>{msg.username}</span>
                )}
                <div style={{
                  maxWidth: '85%',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: isMine
                    ? 'rgba(255,56,100,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  border: isMine
                    ? '1px solid rgba(255,56,100,0.25)'
                    : '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}>
                  {msg.message}
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px',
          flexShrink: 0,
        }}>
          <input
            id="voting-chat-input"
            className="input"
            style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}
            placeholder="Say something..."
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleChatKey}
            maxLength={300}
          />
          <button
            id="voting-chat-send"
            className="btn btn-primary btn-sm"
            onClick={sendMessage}
            disabled={!chatInput.trim()}
          >
            Send
          </button>
        </div>
      </div>

    </div>
  </div>
  );
}
