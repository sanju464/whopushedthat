export default function ResultScreen({
  username, room, socket, myRole, gameOver, voteResult,
  wrongAnswers, nextRound, onPlayAgain, onLeave
}) {
  const isHost = socket.id === room?.hostId;
  const isImposter = myRole === 'imposter';

  // Determine win/loss from my perspective
  const winner = gameOver?.winner || voteResult?.winner;
  const iWon = (winner === 'civilians' && !isImposter) || (winner === 'imposter' && isImposter);
  const isNextRound = (nextRound || voteResult?.noElimination) && !winner;
  const reason = gameOver?.reason;

  const handleNextRound = () => {
    socket.emit('next-round', { code: room.code }, (res) => {
      if (res?.error) console.error(res.error);
    });
  };

  // Game over — show final result
  if (winner) {
    return (
      <div className="screen-center grid-bg" style={{ padding: '24px' }}>
        {/* Background glow */}
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '900px', height: '900px',
          background: `radial-gradient(circle, ${
            iWon
              ? 'rgba(0,255,136,0.08)'
              : 'rgba(255,56,100,0.08)'
          } 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: '500px', textAlign: 'center', animation: 'slide-up 0.5s ease' }}>
          {/* Big result display */}
          <div style={{
            fontSize: '5rem',
            marginBottom: '16px',
            filter: `drop-shadow(0 0 20px ${iWon ? 'rgba(0,255,136,0.5)' : 'rgba(255,56,100,0.5)'})`,
          }}>
            {iWon ? '🏆' : '💀'}
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            color: 'var(--text-secondary)',
            marginBottom: '8px',
          }}>
            {winner === 'civilians' ? 'OPERATION SUCCESS' : 'OPERATION FAILED'}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-title)',
            fontSize: 'clamp(2rem, 8vw, 3rem)',
            fontWeight: 900,
            color: iWon ? 'var(--neon-green)' : 'var(--neon-red)',
            textShadow: iWon
              ? '0 0 30px rgba(0,255,136,0.5)'
              : '0 0 30px rgba(255,56,100,0.5)',
            marginBottom: '8px',
          }}>
            {iWon ? 'YOU WIN!' : 'YOU LOSE!'}
          </h1>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            marginBottom: '32px',
          }}>
            {winner === 'civilians' ? '🛡 Civilians prevail' : '🎭 Imposter wins'}
            {reason && ` — ${reason}`}
          </div>

          {/* Summary card */}
          <div className="card" style={{ textAlign: 'left', marginBottom: '24px' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.2em',
              marginBottom: '16px',
            }}>
              GAME SUMMARY
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Reveal roles */}
              {room?.players?.map(player => {
                const role = voteResult?.roles
                  ? voteResult.roles[player.id]
                  : player.id === socket.id
                    ? myRole
                    : null;
                const isEliminated = room.eliminatedPlayers?.includes(player.id);

                return (
                  <div key={player.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: isEliminated
                      ? 'rgba(255,56,100,0.05)'
                      : 'rgba(255,255,255,0.03)',
                    border: isEliminated
                      ? '1px solid rgba(255,56,100,0.2)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    opacity: isEliminated ? 0.6 : 1,
                  }}>
                    <div style={{
                      width: '32px', height: '32px',
                      borderRadius: '50%',
                      background: `hsl(${(player.username.charCodeAt(0) * 47) % 360}, 55%, 35%)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {player.username[0].toUpperCase()}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        color: player.username === username ? 'var(--neon-green)' : 'var(--text-primary)',
                      }}>
                        {player.username}
                        {player.username === username && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginLeft: '6px' }}>(you)</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {role ? (
                        <span className={`badge ${role === 'imposter' ? 'badge-red' : 'badge-green'}`}>
                          {role === 'imposter' ? '🎭 Imposter' : '🛡 Civilian'}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                          Unknown
                        </span>
                      )}
                      {isEliminated && (
                        <span className="badge badge-red">ELIMINATED</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            <div style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-around',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', color: 'var(--neon-red)' }}>
                  {wrongAnswers}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  WRONG ANSWERS
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', color: 'var(--neon-blue)' }}>
                  {room?.round || 1}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  ROUNDS
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.5rem', color: 'var(--neon-green)' }}>
                  {room?.players?.filter(p => !room.eliminatedPlayers?.includes(p.id)).length || 0}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  SURVIVORS
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-ghost" onClick={onLeave} style={{ flex: '0 0 auto' }}>
              ← Exit
            </button>
            {isHost && (
              <button
                id="play-again-btn"
                className="btn btn-primary btn-full"
                onClick={() => { onPlayAgain(); }}
                style={{ flex: 1 }}
              >
                Play Again
              </button>
            )}
            {!isHost && (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}>
                Waiting for host to restart...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Civilian eliminated → next round
  if (isNextRound && voteResult) {
    const eliminated = voteResult.eliminatedPlayer;

    return (
      <div className="screen-center grid-bg" style={{ padding: '24px' }}>
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px', height: '700px',
          background: 'radial-gradient(circle, rgba(255,56,100,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: '460px', textAlign: 'center', animation: 'slide-up 0.4s ease' }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{voteResult.noElimination ? '⏭️' : '💔'}</div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            color: 'var(--neon-red)',
            marginBottom: '8px',
          }}>
            {voteResult.noElimination ? 'VOTE SKIPPED' : 'WRONG TARGET'}
          </div>

          <h2 style={{
            fontFamily: 'var(--font-title)',
            fontSize: '1.8rem',
            color: 'var(--text-primary)',
            marginBottom: '16px',
          }}>
            {voteResult.noElimination ? 'No one was eliminated' : 'Civilian Eliminated'}
          </h2>

          {eliminated && (
            <div className="card" style={{
              marginBottom: '24px',
              background: 'rgba(255,56,100,0.06)',
              border: '1px solid var(--border-red)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
                {eliminated.username[0].toUpperCase()}
              </div>
              <div style={{
                fontFamily: 'var(--font-title)',
                fontSize: '1.4rem',
                color: 'var(--neon-red)',
                marginBottom: '4px',
              }}>
                {eliminated.username}
              </div>
              <span className="badge badge-green">🛡 WAS A CIVILIAN</span>
              <div style={{
                marginTop: '12px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}>
                The Imposter is still among you...
              </div>
            </div>
          )}

          <div style={{
            padding: '12px',
            background: 'rgba(255,204,0,0.05)',
            border: '1px solid rgba(255,204,0,0.2)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--neon-yellow)',
            marginBottom: '24px',
            letterSpacing: '0.05em',
          }}>
            Round {room?.round} of 3 — Imposter advances
          </div>

          {isHost && (
            <button
              id="next-round-btn"
              className="btn btn-primary btn-full btn-lg"
              onClick={handleNextRound}
            >
              Start Next Round →
            </button>
          )}
          {!isHost && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
            }}>
              Waiting for host to start next round...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading/fallback
  return (
    <div className="screen-center" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
      Processing results...
    </div>
  );
}
