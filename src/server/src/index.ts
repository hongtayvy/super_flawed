import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://teal-beignet-5557d3.netlify.app',
  ],
  credentials: true,
}));

const io = new Server(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://teal-beignet-5557d3.netlify.app',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

interface PlayerType {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  isReady: boolean;
}

const lobbyPlayers: Record<string, PlayerType[]> = {};
const MAX_PLAYERS = 4;

io.on('connection', socket => {
  console.log('A user connected:', socket.id);

  socket.on('join-lobby', ({ gameCode, player }: { gameCode: string; player: PlayerType }) => {
    const code = gameCode.toLowerCase();
    const room = io.sockets.adapter.rooms.get(code);
    const numClients = room ? room.size : 0;

    if (numClients === 0) {
      // first player — create lobby
      lobbyPlayers[code] = [player];
      socket.join(code);
      socket.emit('lobby-players', lobbyPlayers[code]);
    }
    else if (numClients < MAX_PLAYERS) {
      // join existing
      if (!lobbyPlayers[code].some(p => p.id === player.id)) {
        lobbyPlayers[code].push(player);
      }
      socket.join(code);
      io.to(code).emit('lobby-players', lobbyPlayers[code]);
    }
    else {
      // full
      socket.emit('lobby-error', { message: 'Lobby is full.' });
    }
  });

  socket.on('toggle-bots', ({ gameCode }: { gameCode: string }) => {
    const code = gameCode.toLowerCase();
    const bots: PlayerType[] = [
      { id: 'sean', name: 'Sean Jerubin', avatar: '2', isHost: false, score: 0, isReady: false },
      { id: 'rengo', name: 'Rengo Yang', avatar: '4', isHost: false, score: 0, isReady: false },
      { id: 'yeng', name: 'Yeng Chang', avatar: '3', isHost: false, score: 0, isReady: false },
      { id: 'tdawg', name: 'Tdawg Thao', avatar: '3', isHost: false, score: 0, isReady: false },
    ];
    const lobby = lobbyPlayers[code] || [];
    const hasBots = lobby.some(p => bots.map(b => b.id).includes(p.id));
    lobbyPlayers[code] = hasBots
      ? lobby.filter(p => !bots.map(b => b.id).includes(p.id))
      : [...lobby, ...bots];
    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('player-ready', ({ gameCode, playerId, isReady }: { gameCode: string; playerId: string; isReady: boolean }) => {
    const code = gameCode.toLowerCase();
    lobbyPlayers[code] = (lobbyPlayers[code] || []).map(p =>
      p.id === playerId ? { ...p, isReady } : p
    );
    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('start-game', ({ gameCode }: { gameCode: string }) => {
    io.to(gameCode.toLowerCase()).emit('game-started', { gameCode });
  });

  socket.on('leave-lobby', ({ gameCode, playerId }: { gameCode: string; playerId: string }) => {
    const code = gameCode.toLowerCase();
    lobbyPlayers[code] = (lobbyPlayers[code] || []).filter(p => p.id !== playerId);
    socket.leave(code);
    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // (Optional) scan all rooms to remove this socket’s player
  });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Socket server listening on port ${PORT}`);
});