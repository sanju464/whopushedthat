const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const gm = require('./gameManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // ─── CREATE ROOM ────────────────────────────────────────────────────────────
  socket.on('create-room', ({ username }, callback) => {
    if (!username || !username.trim()) {
      return callback({ error: 'Username is required.' });
    }
    const code = gm.createRoom(socket.id, username.trim());
    socket.join(code);
    console.log(`[Room] Created ${code} by ${username}`);
    const room = gm.getRoom(code);
    callback({ success: true, code, room: sanitizeRoom(room, socket.id) });
  });

  // ─── JOIN ROOM ───────────────────────────────────────────────────────────────
  socket.on('join-room', ({ code, username }, callback) => {
    if (!code || !username) {
      return callback({ error: 'Code and username are required.' });
    }
    const result = gm.joinRoom(code.toUpperCase(), socket.id, username.trim());
    if (result.error) return callback({ error: result.error });

    socket.join(code.toUpperCase());
    const room = gm.getRoom(code.toUpperCase());
    console.log(`[Room] ${username} joined ${code.toUpperCase()}`);

    // Notify all players in room
    io.to(code.toUpperCase()).emit('room-updated', sanitizeRoom(room, null));
    callback({ success: true, room: sanitizeRoom(room, socket.id) });
  });

  // ─── START GAME ──────────────────────────────────────────────────────────────
  socket.on('start-game', ({ code }, callback) => {
    const room = gm.getRoom(code);
    if (!room) return callback({ error: 'Room not found.' });
    if (room.hostId !== socket.id) return callback({ error: 'Only the host can start.' });

    const result = gm.startGame(code);
    if (result.error) return callback({ error: result.error });

    console.log(`[Game] Starting in room ${code}`);

    // Send each player their private role and fragment
    result.room.players.forEach((player) => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('role-assigned', {
          role: result.room.roles[player.id],
          fragment: result.room.fragments[player.id],
          problem: {
            title: result.room.problem.title,
            briefing: result.room.problem.briefing,
          },
        });
      }
    });

    // Broadcast game state change to all
    io.to(code).emit('game-state-changed', {
      state: 'role-reveal',
      players: result.room.players,
      round: result.room.round,
    });

    callback({ success: true });

    // After 5s, transition to game
    setTimeout(() => {
      const updatedRoom = gm.transitionToGame(code);
      if (updatedRoom) {
        io.to(code).emit('game-state-changed', {
          state: 'game',
          players: updatedRoom.players,
          round: updatedRoom.round,
        });
      }
    }, 5000);
  });

  // ─── SEND CHAT MESSAGE ───────────────────────────────────────────────────────
  socket.on('send-message', ({ code, message, username }) => {
    if (!message || !message.trim()) return;
    const room = gm.getRoom(code);
    if (!room || room.state !== 'game') return;

    const msg = {
      id: Date.now() + Math.random(),
      username,
      message: message.trim().slice(0, 300),
      timestamp: new Date().toISOString(),
    };

    gm.addMessage(code, msg);
    io.to(code).emit('new-message', msg);
  });

  // ─── VOTE ANSWER (all players) ──────────────────────────────────────────
  socket.on('vote-answer', ({ code, answer }, callback) => {
    const room = gm.getRoom(code);
    if (!room) return callback && callback({ error: 'Room not found.' });
    if (room.state !== 'game') return callback && callback({ error: 'Not in game state.' });

    const result = gm.recordAnswerVote(code, socket.id, answer);
    if (result.error) return callback && callback({ error: result.error });
    if (result.alreadyLocked) return callback && callback({ alreadyLocked: true });

    // Broadcast live tally to the whole room
    io.to(code).emit('answer-votes-updated', {
      tally: result.tally,
      total: result.total,
      majority: result.majority,
    });

    if (callback) callback({ success: true });

    // If majority reached, start 2.5s confirmation countdown
    if (result.majority) {
      const locked = gm.lockAnswers(code);
      if (!locked) return; // another path already locked

      const { answer: majorityAnswer, count, total } = result.majority;
      console.log(`[Answer] Majority reached in ${code}: "${majorityAnswer}" (${count}/${total}) — confirming in 2.5s`);

      // Notify everyone of the countdown
      io.to(code).emit('majority-reached', { answer: majorityAnswer, count, total, delay: 2500 });

      setTimeout(() => {
        // Re-check room is still in game state (could have changed)
        const freshRoom = gm.getRoom(code);
        if (!freshRoom || freshRoom.state !== 'game') return;

        const evalResult = gm.evaluateAnswer(code, majorityAnswer);
        if (evalResult.error) return;

        if (evalResult.correct) {
          io.to(code).emit('game-over', { winner: 'civilians', reason: 'Correct answer by consensus!' });
          io.to(code).emit('game-state-changed', { state: 'result', winner: 'civilians' });
        } else if (evalResult.winner === 'imposter') {
          io.to(code).emit('game-over', { winner: 'imposter', reason: '3 wrong answers. Imposter wins!' });
          io.to(code).emit('game-state-changed', { state: 'result', winner: 'imposter' });
        } else {
          io.to(code).emit('wrong-answer', { wrongAnswers: evalResult.wrongAnswers });
          // Clear tally on the client side
          io.to(code).emit('answer-votes-updated', { tally: {}, total: freshRoom.players.length, majority: null });
          io.to(code).emit('game-state-changed', { state: 'voting' });
        }
      }, 2500);
    }
  });

  // ─── CAST VOTE ───────────────────────────────────────────────────────────────
  socket.on('cast-vote', ({ code, targetId }) => {
    const room = gm.getRoom(code);
    if (!room || room.state !== 'voting') return;

    const result = gm.castVote(code, socket.id, targetId);
    io.to(code).emit('vote-updated', { votes: result.votes });

    if (result.allVoted) {
      resolveVotingPhase(code);
    }
  });

  // ─── FORCE RESOLVE VOTES (host timeout) ─────────────────────────────────────
  socket.on('resolve-votes', ({ code }) => {
    const room = gm.getRoom(code);
    if (!room) return;
    if (room.hostId !== socket.id) return;
    resolveVotingPhase(code);
  });

  // ─── NEXT ROUND ──────────────────────────────────────────────────────────────
  socket.on('next-round', ({ code }, callback) => {
    const room = gm.getRoom(code);
    if (!room) return callback({ error: 'Room not found.' });
    if (room.hostId !== socket.id) return callback({ error: 'Only host can advance.' });

    const result = gm.startGame(code);
    if (result.error) return callback({ error: result.error });

    result.room.players.forEach((player) => {
      if (room.eliminatedPlayers.includes(player.id)) return;
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('role-assigned', {
          role: result.room.roles[player.id],
          fragment: result.room.fragments[player.id],
          problem: {
            title: result.room.problem.title,
            briefing: result.room.problem.briefing,
          },
        });
      }
    });

    io.to(code).emit('game-state-changed', {
      state: 'role-reveal',
      players: result.room.players,
      round: result.room.round,
    });

    callback({ success: true });

    setTimeout(() => {
      const updatedRoom = gm.transitionToGame(code);
      if (updatedRoom) {
        io.to(code).emit('game-state-changed', {
          state: 'game',
          players: updatedRoom.players,
          round: updatedRoom.round,
        });
      }
    }, 5000);
  });

  // ─── DISCONNECT ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
    const result = gm.handleDisconnect(socket.id);
    if (!result) return;

    if (result.roomDeleted) {
      console.log(`[Room] Room ${result.code} deleted (empty)`);
      return;
    }

    const { code, room, disconnectedPlayer } = result;
    io.to(code).emit('player-disconnected', {
      playerId: disconnectedPlayer.id,
      username: disconnectedPlayer.username,
      players: room.players,
      newHostId: room.hostId,
    });
  });

  // ─── GET ROOM STATE ──────────────────────────────────────────────────────────
  socket.on('get-room', ({ code }, callback) => {
    const room = gm.getRoom(code);
    if (!room) return callback({ error: 'Room not found.' });
    callback({ success: true, room: sanitizeRoom(room, socket.id) });
  });
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resolveVotingPhase(code) {
  const result = gm.resolveVotes(code);
  const room = gm.getRoom(code);

  io.to(code).emit('votes-resolved', {
    eliminatedPlayer: result.eliminatedPlayer || null,
    eliminatedRole: result.eliminatedRole || null,
    winner: result.winner || null,
    nextRound: result.nextRound || false,
    noElimination: result.noElimination || false,
    roles: room ? room.roles : {},
    round: room ? room.round : 0,
  });

  if (result.winner) {
    io.to(code).emit('game-state-changed', { state: 'result', winner: result.winner });
  } else if (result.nextRound) {
    io.to(code).emit('game-state-changed', { state: 'result', winner: null, nextRound: true });
  }
}

function sanitizeRoom(room, requestingSocketId) {
  if (!room) return null;
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players,
    state: room.state,
    round: room.round,
    wrongAnswers: room.wrongAnswers,
    eliminatedPlayers: room.eliminatedPlayers,
    winner: room.winner,
    problemTitle: room.problem ? room.problem.title : null,
    problemBriefing: room.problem ? room.problem.briefing : null,
  };
}

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Trust.exe backend running on http://localhost:${PORT}`);
  console.log(`   Socket.IO ready for connections\n`);
});
