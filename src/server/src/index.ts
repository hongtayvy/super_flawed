import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'https://teal-beignet-5557d3.netlify.app', // In production, use frontend URL here
  },
});

app.use(
  cors({
    origin: ['http://localhost:5173', 'https://teal-beignet-5557d3.netlify.app'],
    credentials: true,
  })
);

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
  console.log('User connected:', socket.id);

  socket.on('join-lobby', ({ gameCode, player }) => {
    if (!lobbyPlayers[gameCode]) lobbyPlayers[gameCode] = [];

    const alreadyInLobby = lobbyPlayers[gameCode].some(p => p.id === player.id);
    if (!alreadyInLobby) {
      lobbyPlayers[gameCode].push(player);
    }

    socket.join(gameCode);
    io.to(gameCode).emit('lobby-players', lobbyPlayers[gameCode]);
  });

  socket.on('toggle-bots', ({ gameCode }) => {
    const bots = [
      { id: 'sean', name: 'Sean Jerubin', avatar: '2', isHost: false, score: 0, isReady: false },
      { id: 'rengo', name: 'Rengo Yang', avatar: '4', isHost: false, score: 0, isReady: false },
      { id: 'yeng', name: 'Yeng Chang', avatar: '3', isHost: false, score: 0, isReady: false },
      { id: 'tdawg', name: 'Tdawg Thao', avatar: '3', isHost: false, score: 0, isReady: false }
    ];

    if (!lobbyPlayers[gameCode]) return;

    const botIds = bots.map(bot => bot.id);
    const botsExist = lobbyPlayers[gameCode].some(p => botIds.includes(p.id));

    if (botsExist) {
      lobbyPlayers[gameCode] = lobbyPlayers[gameCode].filter(p => !botIds.includes(p.id));
    } else {
      lobbyPlayers[gameCode] = [...lobbyPlayers[gameCode], ...bots];
    }

    io.to(gameCode).emit('lobby-players', lobbyPlayers[gameCode]);
  });

  socket.on('player-ready', ({ gameCode, playerId, isReady }) => {
    const lobby = lobbyPlayers[gameCode];
    if (!lobby) return;

    lobbyPlayers[gameCode] = lobby.map(player =>
      player.id === playerId ? { ...player, isReady } : player
    );

    io.to(gameCode).emit('lobby-players', lobbyPlayers[gameCode]);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Optional: clean up user from lobbies if desired
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`✅ Socket server listening on port ${PORT}`);
});