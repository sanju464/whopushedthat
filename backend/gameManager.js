const problems = require('./problems.json');

// In-memory store
const rooms = {};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(hostId, hostUsername) {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms[code]);

  rooms[code] = {
    code,
    hostId,
    players: [{ id: hostId, username: hostUsername, isConnected: true }],
    state: 'lobby', // lobby | role-reveal | game | voting | result
    problem: null,
    roles: {},        // socketId -> 'civilian' | 'imposter'
    fragments: {},    // socketId -> fragment string
    wrongAnswers: 0,
    round: 0,
    votes: {},        // voterId -> targetId  (elimination voting)
    answerVotes: {},  // socketId -> answer string  (consensus answers)
    answerLocked: false, // true while the 2.5s confirmation delay is running
    eliminatedPlayers: [],
    messages: [],
    winner: null,
  };

  return code;
}

function joinRoom(code, playerId, username) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found.' };
  if (room.state !== 'lobby') return { error: 'Game already in progress.' };
  if (room.players.length >= 6) return { error: 'Room is full (max 6 players).' };

  const existing = room.players.find(p => p.username === username);
  if (existing) return { error: 'Username already taken in this room.' };

  room.players.push({ id: playerId, username, isConnected: true });
  return { success: true, room };
}

function getRoom(code) {
  return rooms[code] || null;
}

function startGame(code) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found.' };
  if (room.players.length < 3) return { error: 'Need at least 3 players to start.' };

  // Pick random problem
  const problem = problems[Math.floor(Math.random() * problems.length)];
  room.problem = problem;
  room.state = 'role-reveal';
  room.round += 1;
  room.votes = {};
  room.answerVotes = {};
  room.answerLocked = false;

  const activePlayers = room.players.filter(p => !room.eliminatedPlayers.includes(p.id));

  // Assign imposter
  const imposterIndex = Math.floor(Math.random() * activePlayers.length);
  room.roles = {};
  activePlayers.forEach((p, i) => {
    room.roles[p.id] = i === imposterIndex ? 'imposter' : 'civilian';
  });

  // Distribute fragments
  room.fragments = {};
  const shuffledFragments = [...problem.fragments].sort(() => Math.random() - 0.5);

  activePlayers.forEach((p, i) => {
    if (room.roles[p.id] === 'imposter') {
      room.fragments[p.id] = problem.imposter_fragment;
    } else {
      room.fragments[p.id] = shuffledFragments[i % shuffledFragments.length];
    }
  });

  return { success: true, room };
}

function transitionToGame(code) {
  const room = rooms[code];
  if (!room) return null;
  room.state = 'game';
  room.answerVotes = {};
  room.answerLocked = false;
  return room;
}

// ── Consensus answer system ──────────────────────────────────────────────────

/**
 * Record one player's answer vote. Returns:
 *   { answerVotes, majority: { answer, count, total } | null, alreadyLocked }
 */
function recordAnswerVote(code, playerId, answer) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found.' };
  if (room.state !== 'game') return { error: 'Not in game state.' };
  if (room.answerLocked) return { alreadyLocked: true };

  // Record / replace this player's answer
  room.answerVotes[playerId] = answer.trim().toUpperCase();

  // Count active (non-eliminated, connected) players
  const activePlayers = room.players.filter(
    p => p.isConnected !== false && !room.eliminatedPlayers.includes(p.id)
  );
  const total = activePlayers.length;

  // Tally answer counts
  const tally = {};
  for (const ans of Object.values(room.answerVotes)) {
    tally[ans] = (tally[ans] || 0) + 1;
  }

  // Check if any answer reached >= 50% majority
  let majority = null;
  for (const [ans, count] of Object.entries(tally)) {
    if (count >= Math.ceil(total / 2)) {
      majority = { answer: ans, count, total };
      break;
    }
  }

  return { answerVotes: room.answerVotes, tally, majority, total };
}

/**
 * Lock the room (prevents further answer changes during the 2.5s delay).
 * Returns false if already locked.
 */
function lockAnswers(code) {
  const room = rooms[code];
  if (!room || room.answerLocked) return false;
  room.answerLocked = true;
  return true;
}

/**
 * Evaluate the final answer and mutate room state accordingly.
 * Returns same shape as the old submitAnswer.
 */
function evaluateAnswer(code, answer) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found.' };

  const correct = room.problem.answer.trim().toUpperCase() === answer.trim().toUpperCase();

  if (correct) {
    room.state = 'result';
    room.winner = 'civilians';
    return { correct: true, winner: 'civilians' };
  }

  room.wrongAnswers += 1;
  room.answerVotes = {};
  room.answerLocked = false;

  if (room.wrongAnswers >= 3) {
    room.state = 'result';
    room.winner = 'imposter';
    return { correct: false, winner: 'imposter', wrongAnswers: room.wrongAnswers };
  }

  room.state = 'voting';
  room.votes = {};
  return { correct: false, startVoting: true, wrongAnswers: room.wrongAnswers };
}

function castVote(code, voterId, targetId) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found.' };
  room.votes[voterId] = targetId;

  const activePlayers = room.players.filter(p =>
    p.isConnected && !room.eliminatedPlayers.includes(p.id)
  );
  const allVoted = activePlayers.every(p => room.votes[p.id]);

  return { allVoted, votes: room.votes };
}

function resolveVotes(code) {
  const room = rooms[code];
  if (!room) return { error: 'Room not found.' };

  const voteCounts = {};
  Object.values(room.votes).forEach(targetId => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  });

  let maxVotes = 0;
  let eliminatedId = null;
  for (const [id, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = id;
    }
  }

  if (!eliminatedId) {
    // No votes cast — no elimination
    room.state = 'game';
    return { noElimination: true };
  }

  const eliminatedPlayer = room.players.find(p => p.id === eliminatedId);
  room.eliminatedPlayers.push(eliminatedId);

  const eliminatedRole = room.roles[eliminatedId];

  if (eliminatedRole === 'imposter') {
    room.state = 'result';
    room.winner = 'civilians';
    return {
      eliminatedPlayer,
      eliminatedRole,
      winner: 'civilians',
    };
  }

  // Civilian eliminated — check if imposter wins (3 rounds survived)
  if (room.round >= 3) {
    room.state = 'result';
    room.winner = 'imposter';
    return {
      eliminatedPlayer,
      eliminatedRole,
      winner: 'imposter',
    };
  }

  // Continue next round
  room.state = 'result';
  room.winner = null; // no winner yet
  return {
    eliminatedPlayer,
    eliminatedRole,
    nextRound: true,
  };
}

function handleDisconnect(socketId) {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    const player = room.players.find(p => p.id === socketId);
    if (player) {
      player.isConnected = false;

      // If host disconnects and lobby, pick new host or close
      const connectedPlayers = room.players.filter(p => p.isConnected);

      if (connectedPlayers.length === 0) {
        delete rooms[code];
        return { roomDeleted: true, code };
      }

      if (room.hostId === socketId && connectedPlayers.length > 0) {
        room.hostId = connectedPlayers[0].id;
      }

      return { code, room, disconnectedPlayer: player };
    }
  }
  return null;
}

function addMessage(code, message) {
  const room = rooms[code];
  if (!room) return;
  room.messages.push(message);
  if (room.messages.length > 100) room.messages.shift();
}

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  startGame,
  transitionToGame,
  recordAnswerVote,
  lockAnswers,
  evaluateAnswer,
  castVote,
  resolveVotes,
  handleDisconnect,
  addMessage,
};
