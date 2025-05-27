import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(cors({
  origin: ['http://localhost:5173', 'https://teal-beignet-5557d3.netlify.app'],
  credentials: true,
}));

interface PlayerType {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  isReady: boolean;
}

const lobbyPlayers: Record<string, PlayerType[]> = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-lobby', ({ gameCode, player }) => {
    const code = gameCode.toLowerCase();
    if (!lobbyPlayers[code]) lobbyPlayers[code] = [];

    const alreadyInLobby = lobbyPlayers[code].some(p => p.id === player.id);
    if (!alreadyInLobby) {
      lobbyPlayers[code].push(player);
    }

    socket.join(code);
    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('toggle-bots', ({ gameCode }) => {
    const code = gameCode.toLowerCase();
    const botIds = ['sarah', 'jordan', 'morgan'];
    const botsExist = lobbyPlayers[code]?.some(p => botIds.includes(p.id));
    if (!lobbyPlayers[code]) return;

    if (botsExist) {
      lobbyPlayers[code] = lobbyPlayers[code].filter(p => !botIds.includes(p.id));
    } else {
      lobbyPlayers[code].push(
        { id: 'sean', name: 'Sean Jerubin', avatar: '2', isHost: false, score: 0, isReady: false },
        { id: 'rengo', name: 'Rengo Yang', avatar: '4', isHost: false, score: 0, isReady: false },
        { id: 'yeng', name: 'Yeng Chang', avatar: '3', isHost: false, score: 0, isReady: false },
        { id: 'tdawg', name: 'Tdawg Thao', avatar: '3', isHost: false, score: 0, isReady: false }
      );
    }

    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('player-ready', ({ gameCode, playerId, isReady }) => {
    const code = gameCode.toLowerCase();
    const lobby = lobbyPlayers[code];
    if (!lobby) return;

    lobbyPlayers[code] = lobby.map(player =>
      player.id === playerId ? { ...player, isReady } : player
    );

    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('start-game', ({ gameCode }) => {
    const code = gameCode.toLowerCase();
    io.to(code).emit('game-started');
  });

  socket.on('leave-lobby', ({ gameCode, playerId }) => {
    const code = gameCode.toLowerCase();
    lobbyPlayers[code] = (lobbyPlayers[code] || []).filter(p => p.id !== playerId);
    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});
