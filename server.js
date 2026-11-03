import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 2000,
  pingTimeout: 5000,
});

app.use(express.static(join(__dirname, 'public')));

// ─── Data Structures ────────────────────────────────────────────────────────

const rooms = new Map();
const RTT_SAMPLE_COUNT = 10;
const CALIBRATION_INTERVAL_MS = 3000;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? generateRoomCode() : code;
}

function createRoom(hostId, mode) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId,
    mode: mode || 'bee',
    players: new Map(),
    teams: new Map(),
    playerScores: new Map(),
    buzzerOpen: false,
    buzzerOpenTime: null,
    buzzQueue: [],
    lockedOutPlayers: new Set(),
    lockedOutTeams: new Set(),
    currentBuzzPlayerId: null,
    questionNumber: 1,
    questionIncorrectCount: 0,
    justAdvancedFromCorrect: false,
  };
  rooms.set(code, room);
  return room;
}

function getRoomBySocket(socketId) {
  for (const [, room] of rooms) {
    if (room.hostId === socketId || room.players.has(socketId)) return room;
  }
  return null;
}

function getFullRoomState(room) {
  const players = [];
  for (const [id, p] of room.players) {
    players.push({
      id, name: p.name, teamId: p.teamId,
      rtt: Math.round(p.rtt), score: room.playerScores.get(id) || 0,
    });
  }
  const teams = [];
  for (const [id, t] of room.teams) {
    teams.push({ id, name: t.name, score: t.score });
  }
  return {
    code: room.code, mode: room.mode, players, teams,
    buzzerOpen: room.buzzerOpen, buzzQueue: room.buzzQueue,
    lockedOutPlayers: Array.from(room.lockedOutPlayers),
    lockedOutTeams: Array.from(room.lockedOutTeams),
    currentBuzzPlayerId: room.currentBuzzPlayerId,
    questionNumber: room.questionNumber,
    questionIncorrectCount: room.questionIncorrectCount || 0,
  };
}

function broadcastRoomState(room) {
  io.to(room.code).emit('room:state', getFullRoomState(room));
}

// ─── Latency Calibration ────────────────────────────────────────────────────

function startCalibration(socket, player) {
  const interval = setInterval(() => {
    if (socket.connected) {
      player.pendingPingTime = performance.now();
      socket.emit('calibration:ping', player.pendingPingTime);
    } else {
      clearInterval(interval);
    }
  }, CALIBRATION_INTERVAL_MS);

  socket.on('calibration:pong', () => {
    if (player.pendingPingTime !== null) {
      const rtt = performance.now() - player.pendingPingTime;
      player.rttSamples.push(rtt);
      if (player.rttSamples.length > RTT_SAMPLE_COUNT) player.rttSamples.shift();
      const sorted = [...player.rttSamples].sort((a, b) => a - b);
      player.rtt = sorted[Math.floor(sorted.length / 2)];
      player.pendingPingTime = null;
      socket.emit('calibration:update', { rtt: Math.round(player.rtt * 100) / 100, samples: player.rttSamples.length });
    }
  });

  socket.on('disconnect', () => clearInterval(interval));
  player.pendingPingTime = performance.now();
  socket.emit('calibration:ping', player.pendingPingTime);
}

// ─── Socket.IO Events ──────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('room:create', ({ mode }, callback) => {
    const room = createRoom(socket.id, mode);
    socket.join(room.code);
    console.log(`[room:create] Host ${socket.id} → ${room.code} (${mode})`);
    callback({ success: true, code: room.code, state: getFullRoomState(room) });
  });

  socket.on('room:join', ({ code, name }, callback) => {
    const roomCode = code.toUpperCase().trim();
    const room = rooms.get(roomCode);
    if (!room) return callback({ success: false, error: 'Room not found. Check the code and try again.' });
    for (const [, p] of room.players) {
      if (p.name.toLowerCase() === name.trim().toLowerCase())
        return callback({ success: false, error: 'That name is already taken in this room.' });
    }
    const player = { id: socket.id, name: name.trim(), teamId: null, rtt: 0, rttSamples: [], pendingPingTime: null };
    room.players.set(socket.id, player);
    room.playerScores.set(socket.id, 0);
    socket.join(roomCode);
    startCalibration(socket, player);
    console.log(`[room:join] ${name} → ${roomCode}`);
    callback({ success: true, state: getFullRoomState(room) });
    broadcastRoomState(room);
  });

  socket.on('team:add', ({ name }, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return callback?.({ success: false });
    const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    room.teams.set(teamId, { id: teamId, name: name.trim(), score: 0 });
    broadcastRoomState(room);
    callback?.({ success: true, teamId });
  });

  socket.on('team:remove', ({ teamId }, callback) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return callback?.({ success: false });
    room.teams.delete(teamId);
    for (const [, p] of room.players) { if (p.teamId === teamId) p.teamId = null; }
    broadcastRoomState(room);
    callback?.({ success: true });
  });

  socket.on('player:assign-team', ({ playerId, teamId }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const player = room.players.get(playerId);
    if (player) { player.teamId = teamId; broadcastRoomState(room); }
  });

  socket.on('room:set-mode', ({ mode }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.mode = mode;
    broadcastRoomState(room);
  });

  socket.on('buzzer:open', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;

    room.justAdvancedFromCorrect = false;
    room.buzzerOpen = true;
    room.buzzerOpenTime = performance.now();
    room.buzzQueue = [];
    room.currentBuzzPlayerId = null;
    console.log(`[buzzer:open] Room ${room.code} Q${room.questionNumber}`);
    broadcastRoomState(room);
    io.to(room.code).emit('buzzer:opened', { timestamp: room.buzzerOpenTime });
  });

  socket.on('buzzer:close', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    room.buzzerOpen = false;
    room.currentBuzzPlayerId = null;
    broadcastRoomState(room);
  });

  socket.on('buzzer:buzz', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || !room.buzzerOpen) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    if (room.buzzQueue.some(b => b.playerId === socket.id)) return;
    if (room.lockedOutPlayers.has(socket.id)) {
      socket.emit('buzzer:rejected', { reason: 'You are locked out for this question.' });
      return;
    }
    if (room.mode === 'bowl' && player.teamId && room.lockedOutTeams.has(player.teamId)) {
      socket.emit('buzzer:rejected', { reason: 'Your team is locked out for this question.' });
      return;
    }

    const now = performance.now();
    const rawTime = now - room.buzzerOpenTime;
    // Lag correction: raw elapsed ≈ RTT + reaction_time, so adjusted ≈ raw - RTT
    const adjustedTime = Math.max(0, rawTime - player.rtt);

    const entry = {
      playerId: socket.id, playerName: player.name, teamId: player.teamId,
      rawTime: Math.round(rawTime * 100) / 100,
      adjustedTime: Math.round(adjustedTime * 100) / 100,
      rtt: Math.round(player.rtt * 100) / 100,
    };

    let inserted = false;
    for (let i = 0; i < room.buzzQueue.length; i++) {
      if (adjustedTime < room.buzzQueue[i].adjustedTime) {
        room.buzzQueue.splice(i, 0, entry);
        inserted = true;
        break;
      }
    }
    if (!inserted) room.buzzQueue.push(entry);

    if (room.buzzQueue.length === 1 || room.buzzQueue[0].playerId === socket.id) {
      room.currentBuzzPlayerId = socket.id;
      room.buzzerOpen = false;
    }

    console.log(`[buzz] ${player.name}: raw=${entry.rawTime}ms adj=${entry.adjustedTime}ms rtt=${entry.rtt}ms`);
    broadcastRoomState(room);
    io.to(room.code).emit('buzzer:buzzed', { queue: room.buzzQueue, recognized: room.buzzQueue[0] });
  });

  socket.on('answer:correct', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const recognized = room.buzzQueue[0];
    if (!recognized) return;

    const points = room.mode === 'bee' ? 1 : 10;
    if (room.mode === 'bee') {
      const cur = room.playerScores.get(recognized.playerId) || 0;
      room.playerScores.set(recognized.playerId, cur + 1);
    } else if (room.mode === 'bowl' && recognized.teamId) {
      const team = room.teams.get(recognized.teamId);
      if (team) team.score += 10;
    }

    // Automatically move to the next question
    room.questionNumber++;
    room.questionIncorrectCount = 0;
    room.buzzQueue = [];
    room.lockedOutPlayers.clear();
    room.lockedOutTeams.clear();
    room.currentBuzzPlayerId = null;
    room.buzzerOpen = false;
    room.buzzerOpenTime = null;
    room.justAdvancedFromCorrect = true;

    console.log(`[correct] ${recognized.playerName} (+${points} point${points > 1 ? 's' : ''}) → Auto-moved to Q${room.questionNumber}`);
    broadcastRoomState(room);
    io.to(room.code).emit('answer:result', { correct: true, player: recognized, points });
  });

  socket.on('answer:incorrect', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const recognized = room.buzzQueue[0];
    if (!recognized) return;

    room.lockedOutPlayers.add(recognized.playerId);
    if (room.mode === 'bowl' && recognized.teamId) {
      room.lockedOutTeams.add(recognized.teamId);
    }

    room.buzzQueue.shift();
    // In Bowl mode, also remove any queued buzzes from teammates who are now locked out
    if (room.mode === 'bowl' && recognized.teamId) {
      room.buzzQueue = room.buzzQueue.filter(b => b.teamId !== recognized.teamId);
    }

    // For Bee mode, track incorrect guesses and trigger deduction + next question on 3rd incorrect
    if (room.mode === 'bee') {
      room.questionIncorrectCount = (room.questionIncorrectCount || 0) + 1;

      if (room.questionIncorrectCount >= 3) {
        const cur = room.playerScores.get(recognized.playerId) || 0;
        room.playerScores.set(recognized.playerId, cur - 1);

        room.questionNumber++;
        room.questionIncorrectCount = 0;
        room.buzzQueue = [];
        room.lockedOutPlayers.clear();
        room.lockedOutTeams.clear();
        room.currentBuzzPlayerId = null;
        room.buzzerOpen = false;
        room.buzzerOpenTime = null;
        room.justAdvancedFromCorrect = true;

        console.log(`[incorrect-3rd] ${recognized.playerName} (-1 point) → 3rd incorrect guess triggered Q${room.questionNumber}`);
        broadcastRoomState(room);
        io.to(room.code).emit('answer:result', {
          correct: false,
          player: recognized,
          penalty: true,
          thirdIncorrect: true,
        });
        return;
      }
    }

    room.currentBuzzPlayerId = null;
    if (room.buzzQueue.length > 0) {
      room.currentBuzzPlayerId = room.buzzQueue[0].playerId;
      room.buzzerOpen = false;
    } else {
      room.buzzerOpen = true;
      room.buzzerOpenTime = performance.now();
    }

    console.log(`[incorrect] ${recognized.playerName} locked out (${room.mode === 'bee' ? room.questionIncorrectCount + '/3' : 'bowl'})`);
    broadcastRoomState(room);
    io.to(room.code).emit('answer:result', {
      correct: false,
      player: recognized,
      penalty: false,
      incorrectCount: room.questionIncorrectCount || 0,
    });
    if (room.buzzerOpen) io.to(room.code).emit('buzzer:opened', { timestamp: room.buzzerOpenTime });
  });

  socket.on('question:next', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;

    // Advance question unless we just auto-advanced from a correct answer or 3rd incorrect
    if (!room.justAdvancedFromCorrect) {
      room.questionNumber++;
    }
    room.justAdvancedFromCorrect = false;
    room.questionIncorrectCount = 0;

    room.buzzQueue = [];
    room.lockedOutPlayers.clear();
    room.lockedOutTeams.clear();
    room.currentBuzzPlayerId = null;

    // Automatically reopen the buzzer!
    room.buzzerOpen = true;
    room.buzzerOpenTime = performance.now();

    console.log(`[next] Room ${room.code} → Q${room.questionNumber} (Buzzer Reopened)`);
    broadcastRoomState(room);
    io.to(room.code).emit('buzzer:opened', { timestamp: room.buzzerOpenTime });
  });

  socket.on('scores:reset', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    for (const [id] of room.playerScores) room.playerScores.set(id, 0);
    for (const [, team] of room.teams) team.score = 0;
    room.questionNumber = 1;
    room.questionIncorrectCount = 0;
    room.justAdvancedFromCorrect = false;
    room.buzzQueue = [];
    room.lockedOutPlayers.clear();
    room.lockedOutTeams.clear();
    room.buzzerOpen = false;
    room.currentBuzzPlayerId = null;
    broadcastRoomState(room);
  });

  socket.on('player:kick', ({ playerId }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id) return;
    const ps = io.sockets.sockets.get(playerId);
    if (ps) { ps.emit('room:kicked'); ps.leave(room.code); }
    room.players.delete(playerId);
    room.playerScores.delete(playerId);
    broadcastRoomState(room);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (room.hostId === socket.id) {
      io.to(room.code).emit('room:destroyed', { reason: 'Host disconnected' });
      rooms.delete(room.code);
    } else {
      room.players.delete(socket.id);
      room.playerScores.delete(socket.id);
      broadcastRoomState(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`\n  🐝 SuperBuzz server running at http://localhost:${PORT}\n`);
});
