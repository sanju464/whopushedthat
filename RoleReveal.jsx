import { useEffect, useState } from 'react';

export default function RoleReveal({ username, room, myRole, myFragment, problemInfo }) {
  const [countdown, setCountdown] = useState(5);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Slight delay before revealing
    const revealTimer = setTimeout(() => setRevealed(true), 500);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(revealTimer);
      clearInterval(interval);
    };
  }, []);

  const isImposter = myRole === 'imposter';

  return (
    <div className="screen-center grid-bg" style={{ padding: '24px' }}>
      {/* Background glow based on role */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px', height: '800px',
        background: `radial-gradient(circle, ${
          isImposter
            ? 'rgba(255,56,100,0.06)'
            : 'rgba(0,255,136,0.05)'
        } 0%, transparent 70%)`,
        pointerEvents: 'none',
        transition: 'all 1s ease',
      }} />

      <div style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        {/* Pre-reveal state */}
        {!revealed ? (
          <div style={{ animation: 'fade-in 0.3s ease' }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--neon-green)',
              letterSpacing: '0.3em',
              marginBottom: '16px',
            }}>
              ACCESSING CLASSIFIED FILES...
            </div>
            <div style={{
              fontFamily: 'var(--font-title)',
              fontSize: '4rem',
              color: 'var(--neon-green)',
              animation: 'glow-pulse 1s infinite',
            }}>
              ████
            </div>
          </div>
        ) : (
          <div style={{ animation: 'reveal-role 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}>
            {/* Role card */}
            <div style={{
              background: isImposter
                ? 'linear-gradient(135deg, rgba(255,56,100,0.08), rgba(191,95,255,0.08))'
                : 'linear-gradient(135deg, rgba(0,255,136,0.06), rgba(0,212,255,0.06))',
              border: `1px solid ${isImposter ? 'var(--border-red)' : 'var(--border-green)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '40px 32px',
              marginBottom: '24px',
              boxShadow: isImposter
                ? '0 0 60px rgba(255,56,100,0.15)'
                : '0 0 60px rgba(0,255,136,0.12)',
            }}>
              <div style={{
                fontSize: '3.5rem',
                marginBottom: '16px',
                filter: `drop-shadow(0 0 15px ${isImposter ? 'rgba(255,56,100,0.6)' : 'rgba(0,255,136,0.6)'})`,
              }}>
                {isImposter ? '🎭' : '🛡️'}
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                letterSpacing: '0.3em',
                color: 'var(--text-secondary)',
                marginBottom: '8px',
                textTransform: 'uppercase',
              }}>
                Your Role
              </div>

              <div style={{
                fontFamily: 'var(--font-title)',
                fontSize: '2.2rem',
                fontWeight: 900,
                color: isImposter ? 'var(--neon-red)' : 'var(--neon-green)',
                letterSpacing: '0.1em',
                textShadow: isImposter
                  ? '0 0 20px rgba(255,56,100,0.5)'
                  : '0 0 20px rgba(0,255,136,0.4)',
                marginBottom: '16px',
              }}>
                {isImposter ? 'IMPOSTER' : 'CIVILIAN'}
              </div>

              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                maxWidth: '360px',
                margin: '0 auto',
              }}>
                {isImposter
                  ? '⚠ Your fragment is CORRUPTED. Mislead the team without getting caught. Survive 3 rounds or cause 3 wrong answers to win.'
                  : '✓ Work with your team to decode the cipher. Find and eliminate the Imposter hiding among you.'}
              </div>
            </div>

            {/* Problem info */}
            {problemInfo && (
              <div className="card" style={{ marginBottom: '20px', textAlign: 'left' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--neon-green-dim)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  Mission Briefing
                </div>
                <div style={{
                  fontFamily: 'var(--font-title)',
                  fontSize: '1rem',
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}>
                  {problemInfo.title}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                }}>
                  {problemInfo.briefing}
                </div>
              </div>
            )}

            {/* Your fragment */}
            {myFragment && (
              <div style={{
                background: 'rgba(0,0,0,0.4)',
                border: `1px solid ${isImposter ? 'var(--border-red)' : 'var(--border-green)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                textAlign: 'left',
                marginBottom: '24px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: isImposter ? 'var(--neon-red)' : 'var(--neon-green)',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}>
                  {isImposter ? '⚠ Your Fragment [CORRUPTED]' : '▸ Your Fragment'}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.7,
                }}>
                  {myFragment}
                </div>
                {isImposter && (
                  <div style={{
                    position: 'absolute',
                    top: '8px', right: '8px',
                    fontSize: '0.6rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--neon-red)',
                    letterSpacing: '0.1em',
                    opacity: 0.7,
                  }}>
                    [CLASSIFIED]
                  </div>
                )}
              </div>
            )}

            {/* Countdown */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              letterSpacing: '0.15em',
            }}>
              {countdown > 0
                ? `Game starts in ${countdown}...`
                : 'LOADING GAME...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
