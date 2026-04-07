import { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import Landing from './screens/Landing';
import WaitingRoom from './screens/WaitingRoom';
import RoleReveal from './screens/RoleReveal';
import GameScreen from './screens/GameScreen';
import VotingScreen from './screens/VotingScreen';
import ResultScreen from './screens/ResultScreen';

const SCREENS = {
  landing: 'landing',
  waiting: 'waiting',
  roleReveal: 'role-reveal',
  game: 'game',
  voting: 'voting',
  result: 'result',
};

export default function App() {
  const [screen, setScreen] = useState(SCREENS.landing);
  const [username, setUsername] = useState('');
  const [room, setRoom] = useState(null);         // room metadata (safe, no secrets)
  const [myRole, setMyRole] = useState(null);     // 'civilian' | 'imposter'
  const [myFragment, setMyFragment] = useState(null);
  const [problemInfo, setProblemInfo] = useState(null); // { title, briefing }
  const [voteResult, setVoteResult] = useState(null);
  const [gameOver, setGameOver] = useState(null);  // { winner, reason }
  const [wrongAnswers, setWrongAnswers] = useState(0);
  const [messages, setMessages] = useState([]);
  const [votes, setVotes] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [nextRound, setNextRound] = useState(false);
  // Consensus answer state
  const [answerVotes, setAnswerVotes] = useState({}); // { ANSWER: count }
  const [majorityInfo, setMajorityInfo] = useState(null); // { answer, count, total, delay }

  // ── Socket listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    socket.on('connect_error', () => setConnectionStatus('error'));

    // Room updated (someone joined)
    socket.on('room-updated', (updatedRoom) => {
      setRoom(updatedRoom);
    });

    // Role assigned privately
    socket.on('role-assigned', ({ role, fragment, problem }) => {
      setMyRole(role);
      setMyFragment(fragment);
      setProblemInfo(problem);
    });

    // Central game state machine
    socket.on('game-state-changed', ({ state, players, round, winner, nextRound: nr }) => {
      if (players) {
        setRoom(prev => prev ? { ...prev, players, round: round || prev.round } : prev);
      }

      if (state === 'role-reveal') {
        setScreen(SCREENS.roleReveal);
        setMessages([]);
        setVotes({});
        setVoteResult(null);
        setAnswerVotes({});
        setMajorityInfo(null);
      } else if (state === 'game') {
        setWrongAnswers(0);
        setAnswerVotes({});
        setMajorityInfo(null);
        setScreen(SCREENS.game);
      } else if (state === 'voting') {
        setAnswerVotes({});
        setMajorityInfo(null);
        setScreen(SCREENS.voting);
      } else if (state === 'result') {
        setGameOver(winner ? { winner } : null);
        setNextRound(!!nr);
        setScreen(SCREENS.result);
      }
    });

    // Live answer tally updates
    socket.on('answer-votes-updated', ({ tally, majority }) => {
      setAnswerVotes(tally || {});
      if (!majority) setMajorityInfo(null);
    });

    // Majority consensus reached — show confirmation countdown
    socket.on('majority-reached', (info) => {
      setMajorityInfo(info);
    });

    // Chat messages
    socket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    // Wrong answer broadcast
    socket.on('wrong-answer', ({ wrongAnswers: wa }) => {
      setWrongAnswers(wa);
    });

    // Vote updates
    socket.on('vote-updated', ({ votes: v }) => {
      setVotes(v);
    });

    // Votes resolved
    socket.on('votes-resolved', (result) => {
      setVoteResult(result);
    });

    // Game over
    socket.on('game-over', ({ winner, reason }) => {
      setGameOver({ winner, reason });
    });

    // Player disconnected
    socket.on('player-disconnected', ({ players, newHostId, username: dcName }) => {
      setRoom(prev => prev ? { ...prev, players, hostId: newHostId } : prev);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('room-updated');
      socket.off('role-assigned');
      socket.off('game-state-changed');
      socket.off('new-message');
      socket.off('wrong-answer');
      socket.off('vote-updated');
      socket.off('votes-resolved');
      socket.off('game-over');
      socket.off('player-disconnected');
      socket.off('answer-votes-updated');
      socket.off('majority-reached');
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleRoomCreated = useCallback((roomData, user) => {
    setUsername(user);
    setRoom(roomData);
    setScreen(SCREENS.waiting);
  }, []);

  const handleRoomJoined = useCallback((roomData, user) => {
    setUsername(user);
    setRoom(roomData);
    setScreen(SCREENS.waiting);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    socket.disconnect();
    socket.connect();
    setRoom(null);
    setMyRole(null);
    setMyFragment(null);
    setProblemInfo(null);
    setMessages([]);
    setVotes({});
    setVoteResult(null);
    setGameOver(null);
    setWrongAnswers(0);
    setNextRound(false);
    setAnswerVotes({});
    setMajorityInfo(null);
    setScreen(SCREENS.landing);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameOver(null);
    setVoteResult(null);
    setMessages([]);
    setVotes({});
    setMyRole(null);
    setMyFragment(null);
    setNextRound(false);
    setAnswerVotes({});
    setMajorityInfo(null);
    setScreen(SCREENS.waiting);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const commonProps = { username, room, socket };

  return (
    <>
      {connectionStatus === 'connecting' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(0,212,255,0.9)', color: '#fff',
          textAlign: 'center', padding: '8px',
          fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
          letterSpacing: '0.1em',
        }}>
          ↯ INITIALIZING CONNECTION TO SERVER...
        </div>
      )}

      {connectionStatus === 'error' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(255,204,0,0.95)', color: '#000',
          textAlign: 'center', padding: '8px',
          fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
          letterSpacing: '0.1em',
        }}>
          ⚠ CONNECTION ERROR — Retrying...
        </div>
      )}

      {connectionStatus === 'disconnected' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(255,56,100,0.95)', color: '#fff',
          textAlign: 'center', padding: '8px',
          fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
          letterSpacing: '0.1em',
        }}>
          ⚠ CONNECTION LOST — Attempting to reconnect...
        </div>
      )}

      {screen === SCREENS.landing && (
        <Landing
          onRoomCreated={handleRoomCreated}
          onRoomJoined={handleRoomJoined}
        />
      )}

      {screen === SCREENS.waiting && (
        <WaitingRoom
          {...commonProps}
          onLeave={handleLeaveRoom}
        />
      )}

      {screen === SCREENS.roleReveal && (
        <RoleReveal
          {...commonProps}
          myRole={myRole}
          myFragment={myFragment}
          problemInfo={problemInfo}
        />
      )}

      {screen === SCREENS.game && (
        <GameScreen
          {...commonProps}
          myRole={myRole}
          myFragment={myFragment}
          problemInfo={problemInfo}
          messages={messages}
          wrongAnswers={wrongAnswers}
          answerVotes={answerVotes}
          majorityInfo={majorityInfo}
          onLeave={handleLeaveRoom}
        />
      )}

      {screen === SCREENS.voting && (
        <VotingScreen
          {...commonProps}
          myRole={myRole}
          voteResult={voteResult}
          votes={votes}
          wrongAnswers={wrongAnswers}
        />
      )}

      {screen === SCREENS.result && (
        <ResultScreen
          {...commonProps}
          myRole={myRole}
          gameOver={gameOver}
          voteResult={voteResult}
          wrongAnswers={wrongAnswers}
          nextRound={nextRound}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeaveRoom}
        />
      )}
    </>
  );
}
