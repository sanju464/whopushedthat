import { useState, useRef, useEffect } from 'react';

export default function GameScreen({
  username, room, socket, myRole, myFragment, problemInfo,
  messages, wrongAnswers, answerVotes, majorityInfo, onLeave
}) {
  const [chatInput, setChatInput] = useState('');
  const [myAnswer, setMyAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false); // has the player cast their answer vote
  const [countdown, setCountdown] = useState(null);  // seconds left in majority confirmation
  const chatEndRef = useRef(null);
  const countdownRef = useRef(null);

  const isImposter = myRole === 'imposter';
  const activePlayers = room?.players?.filter(p =>
    p.isConnected !== false && !room.eliminatedPlayers?.includes(p.id)
  ) || [];
  const totalPlayers = activePlayers.length;

  // Sorted tally for display: [ [answer, count], ... ] descending
  const tallyEntries = Object.entries(answerVotes || {})
    .sort((a, b) => b[1] - a[1]);
  const agreementCount = myAnswer ? (answerVotes?.[myAnswer.toUpperCase()] || 0) : 0;

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Majority countdown ticker
  useEffect(() => {
    if (majorityInfo) {
      const secs = Math.ceil((majorityInfo.delay || 2500) / 1000);
      setCountdown(secs);
      let remaining = secs;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) clearInterval(countdownRef.current);
      }, 1000);
    } else {
      clearInterval(countdownRef.current);
      setCountdown(null);
    }
    return () => clearInterval(countdownRef.current);
  }, [majorityInfo]);

  // Reset submitted flag when answerVotes are cleared (new round / after wrong answer)
  useEffect(() => {
    if (!answerVotes || Object.keys(answerVotes).length === 0) {
      setSubmitted(false);
      setMyAnswer('');
      setSubmitError('');
    }
  }, [answerVotes]);

  const sendMessage = () => {
    if (!chatInput.trim()) return;
    socket.emit('send-message', {
      code: room.code,
      message: chatInput.trim(),
      username,
    });
    setChatInput('');
  };

  const handleChatKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Submit / change this player's answer vote
  const handleVoteAnswer = () => {
    const trimmed = myAnswer.trim();
    if (!trimmed || majorityInfo) return; // locked during countdown
    setSubmitting(true);
    setSubmitError('');
    socket.emit('vote-answer', { code: room.code, answer: trimmed }, (res) => {
      setSubmitting(false);
      if (res?.error) {
        setSubmitError(res.error);
      } else if (!res?.alreadyLocked) {
        setSubmitted(true);
      }
    });
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--bg-void)',
      overflow: 'hidden',
    }}>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--bg-dark)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span className="title-flicker" style={{
              fontFamily: 'var(--font-title)',
              fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #00ff88, #00d4ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.03em',
            }}>
              WhoPushedThat.exe
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.55rem',
              fontStyle: 'italic',
              color: 'var(--neon-green-dim)',
              opacity: 0.55,
              letterSpacing: '0.06em',
            }}>
              still debugging...
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className={`badge ${isImposter ? 'badge-red' : 'badge-green'}`}>
              {isImposter ? '🎭 IMPOSTER' : '🛡 CIVILIAN'}
            </span>
            <span className="badge badge-blue">
              ROUND {room?.round || 1}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Wrong answer counter */}
          <div style={{
            display: 'flex',
            gap: '4px',
          }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                width: '8px', height: '8px',
                borderRadius: '50%',
                background: i <= wrongAnswers ? 'var(--neon-red)' : 'var(--border-subtle)',
                boxShadow: i <= wrongAnswers ? '0 0 6px var(--neon-red)' : 'none',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
          }}>
            WRONG ANSWERS
          </span>

          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
          }}>
            #{room?.code}
          </span>

          <button className="btn btn-ghost btn-sm" onClick={onLeave}>Leave</button>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '0',
        overflow: 'hidden',
      }}>
        {/* ── Left panel: Fragment + Problem + Answer ───────────── */}
        <div style={{
          width: '360px',
          flexShrink: 0,
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          padding: '16px',
          gap: '12px',
        }}>
          {/* Mission briefing */}
          {problemInfo && (
            <div className="card" style={{ borderColor: 'rgba(0,212,255,0.2)' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: 'var(--neon-blue)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}>
                🔍 Mission: {problemInfo.title}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.77rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}>
                {problemInfo.briefing}
              </div>
            </div>
          )}

          {/* Your fragment */}
          <div style={{
            background: isImposter ? 'rgba(255,56,100,0.05)' : 'rgba(0,255,136,0.04)',
            border: `1px solid ${isImposter ? 'var(--border-red)' : 'var(--border-green)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: isImposter ? 'var(--neon-red)' : 'var(--neon-green)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>▸ Your Fragment</span>
              {isImposter && <span style={{ color: 'var(--neon-red)' }}>★ CORRUPTED</span>}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.83rem',
              color: 'var(--text-primary)',
              lineHeight: 1.8,
            }}>
              {myFragment || '...'}
            </div>
          </div>

          {/* Players online */}
          <div className="card">
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}>
              Active Operatives ({activePlayers.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {activePlayers.map(p => (
                <div key={p.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: p.id === room?.hostId ? 'rgba(0,255,136,0.08)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.id === room?.hostId ? 'var(--border-green)' : 'var(--border-subtle)'}`,
                  borderRadius: '100px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: p.username === username ? 'var(--neon-green)' : 'var(--text-secondary)',
                }}>
                  <div style={{
                    width: '6px', height: '6px',
                    borderRadius: '50%',
                    background: 'var(--neon-green)',
                    boxShadow: '0 0 4px var(--neon-green)',
                  }} />
                  {p.username}
                  {p.id === room?.hostId && ' ★'}
                </div>
              ))}
            </div>
          </div>

          {/* ── Answer consensus panel (all players) ──────────── */}
          <div style={{
            background: majorityInfo
              ? 'rgba(0,212,255,0.06)'
              : isImposter ? 'rgba(255,56,100,0.04)' : 'rgba(0,255,136,0.04)',
            border: `1px solid ${majorityInfo ? 'rgba(0,212,255,0.4)' : isImposter ? 'var(--border-red)' : 'var(--border-green)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            transition: 'all 0.4s ease',
          }}>
            {/* Majority countdown banner */}
            {majorityInfo && (
              <div style={{
                marginBottom: '12px',
                padding: '10px 12px',
                background: 'rgba(0,212,255,0.12)',
                border: '1px solid rgba(0,212,255,0.3)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                animation: 'glow-pulse 1s infinite',
              }}>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.6rem',
                    color: 'var(--neon-blue)',
                    letterSpacing: '0.2em',
                    marginBottom: '2px',
                  }}>
                    ⚡ MAJORITY REACHED
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-title)',
                    fontSize: '1rem',
                    color: 'var(--neon-blue)',
                    letterSpacing: '0.1em',
                  }}>
                    &ldquo;{majorityInfo.answer}&rdquo;
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-secondary)',
                    marginTop: '2px',
                  }}>
                    {majorityInfo.count}/{majorityInfo.total} players agree
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '1.8rem',
                  color: countdown <= 1 ? 'var(--neon-red)' : 'var(--neon-blue)',
                  minWidth: '40px',
                  textAlign: 'center',
                  transition: 'color 0.3s',
                }}>
                  {countdown}
                </div>
              </div>
            )}

            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: isImposter ? 'var(--neon-red)' : 'var(--neon-green)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}>
              ⊕ Your Answer Vote
            </div>

            {/* Input row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                id="answer-input"
                className="input"
                placeholder={submitted ? 'Change your answer...' : 'Your decoded answer...'}
                value={myAnswer}
                onChange={e => setMyAnswer(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleVoteAnswer()}
                disabled={!!majorityInfo}
                style={{ flex: 1, textTransform: 'uppercase', opacity: majorityInfo ? 0.5 : 1 }}
              />
              <button
                id="submit-answer-btn"
                className={`btn ${submitted ? 'btn-ghost' : 'btn-primary'}`}
                onClick={handleVoteAnswer}
                disabled={submitting || !myAnswer.trim() || !!majorityInfo}
              >
                {submitting ? '...' : submitted ? 'UPDATE' : 'VOTE'}
              </button>
            </div>

            {/* Agreement indicator */}
            {submitted && myAnswer && (
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: agreementCount > 1 ? 'var(--neon-green)' : 'var(--text-secondary)',
                marginBottom: tallyEntries.length > 0 ? '10px' : '0',
                transition: 'color 0.3s',
              }}>
                {agreementCount > 1
                  ? `✓ ${agreementCount}/${totalPlayers} players agree on "${myAnswer.toUpperCase()}"`
                  : `Waiting for others... (${agreementCount}/${totalPlayers})`}
              </div>
            )}

            {/* Live tally */}
            {tallyEntries.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '4px',
                }}>
                  Live Votes
                </div>
                {tallyEntries.map(([ans, count]) => (
                  <div key={ans} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    {/* Bar */}
                    <div style={{
                      flex: 1,
                      position: 'relative',
                      height: '22px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${ans === myAnswer.toUpperCase() ? 'var(--border-green)' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        position: 'absolute',
                        left: 0, top: 0, bottom: 0,
                        width: `${(count / totalPlayers) * 100}%`,
                        background: ans === myAnswer.toUpperCase()
                          ? 'rgba(0,255,136,0.2)'
                          : 'rgba(255,255,255,0.06)',
                        transition: 'width 0.4s ease',
                      }} />
                      <span style={{
                        position: 'absolute',
                        left: '8px', top: '50%',
                        transform: 'translateY(-50%)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        color: ans === myAnswer.toUpperCase() ? 'var(--neon-green)' : 'var(--text-primary)',
                        letterSpacing: '0.08em',
                      }}>
                        {ans}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--text-secondary)',
                      minWidth: '40px',
                      textAlign: 'right',
                    }}>
                      {count}/{totalPlayers}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {submitError && (
              <div className="error-msg" style={{ marginTop: '8px' }}>⚠ {submitError}</div>
            )}

            <div style={{
              marginTop: '10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              lineHeight: 1.5,
            }}>
              {majorityInfo
                ? '🔒 Votes locked — evaluating answer...'
                : `Majority needed: ≥${Math.ceil(totalPlayers / 2)} of ${totalPlayers} players`}
            </div>
          </div>
        </div>

        {/* ── Right panel: Chat ──────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Chat header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            letterSpacing: '0.1em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <div style={{
              width: '6px', height: '6px',
              borderRadius: '50%',
              background: 'var(--neon-green)',
              boxShadow: '0 0 6px var(--neon-green)',
            }} />
            SECURE CHANNEL · DISCUSS FRAGMENTS · FIND THE TRUTH
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '40px',
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.3 }}>💬</div>
                No messages yet. Share your clues!
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{
                display: 'flex',
                gap: '10px',
                animation: 'slide-in-right 0.2s ease',
                alignItems: 'flex-start',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '28px', height: '28px',
                  borderRadius: '50%',
                  background: `hsl(${(msg.username.charCodeAt(0) * 47) % 360}, 55%, 38%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: '#fff',
                  flexShrink: 0,
                  marginTop: '2px',
                }}>
                  {msg.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    marginBottom: '2px',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      color: msg.username === username ? 'var(--neon-green)' : 'var(--neon-blue)',
                      fontWeight: 'bold',
                    }}>
                      {msg.username}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6rem',
                      color: 'var(--text-muted)',
                    }}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}>
                    {msg.message}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: '10px',
          }}>
            <input
              id="chat-input"
              className="input"
              placeholder="Share your clues... (Enter to send)"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={handleChatKey}
              maxLength={300}
              style={{ flex: 1 }}
            />
            <button
              id="send-message-btn"
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
