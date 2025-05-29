import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = ['https://teal-beignet-5557d3.netlify.app'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.options('*', cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

interface PlayerType {
  id: string;
  name: string;
  avatar: string;
  isHost: boolean;
  score: number;
  isReady: boolean;
  isBot: boolean;
}

interface CardType {
  id: string;
  text: string;
  [key: string]: any;
}

interface CardSubmission {
  playerId: string;
  card: CardType;
}

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

const lobbyPlayers: Record<string, PlayerType[]> = {};

const games: Record<string, {
  submissions: CardSubmission[];
  chat: ChatMessage[];
}> = {};

const MAX_PLAYERS = 16;

io.on('connection', socket => {
  console.log('✅ A user connected:', socket.id);

  socket.on('join-lobby', ({ gameCode, player }: { gameCode: string; player: PlayerType }) => {
    const code = gameCode.toLowerCase();
    const room = io.sockets.adapter.rooms.get(code);
    const numClients = room ? room.size : 0;

    if (numClients === 0) {
      lobbyPlayers[code] = [player];
      socket.join(code);
      socket.emit('lobby-players', lobbyPlayers[code]);
    } else if (numClients < MAX_PLAYERS) {
      if (!lobbyPlayers[code].some(p => p.id === player.id)) {
        lobbyPlayers[code].push(player);
      }
      socket.join(code);
      io.to(code).emit('lobby-players', lobbyPlayers[code]);
    } else {
      socket.emit('lobby-error', { message: 'Lobby is full.' });
    }
  });

  socket.on('toggle-bots', ({ gameCode }: { gameCode: string }) => {
    const code = gameCode.toLowerCase();
    const bots: PlayerType[] = [
      { id: 'sean', name: 'Sean Jerubin', avatar: '2', isHost: false, score: 0, isReady: false, isBot: true },
      { id: 'rengo', name: 'Rengo Yang', avatar: '4', isHost: false, score: 0, isReady: false, isBot: true },
      { id: 'yeng', name: 'Yeng Chang', avatar: '3', isHost: false, score: 0, isReady: false, isBot: true },
      { id: 'tdawg', name: 'Tdawg Thao', avatar: '3', isHost: false, score: 0, isReady: false, isBot: true },
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

  socket.on('submit-card', ({ gameCode, submission }: { gameCode: string; submission: CardSubmission }) => {
    const code = gameCode.toLowerCase();
    if (!games[code]) games[code] = { submissions: [], chat: [] };

    const existingIndex = games[code].submissions.findIndex(s => s.playerId === submission.playerId);
    if (existingIndex !== -1) {
      games[code].submissions[existingIndex] = submission;
    } else {
      games[code].submissions.push(submission);
    }

    io.to(code).emit('update-submissions', games[code].submissions);
  });

  socket.on('chat-message', ({ gameCode, message }: { gameCode: string; message: ChatMessage }) => {
    const code = gameCode.toLowerCase();
    if (!games[code]) games[code] = { submissions: [], chat: [] };

    games[code].chat.push(message);
    io.to(code).emit('chat-message', message);
  });

  socket.on('leave-lobby', ({ gameCode, playerId }: { gameCode: string; playerId: string }) => {
    const code = gameCode.toLowerCase();
    lobbyPlayers[code] = (lobbyPlayers[code] || []).filter(p => p.id !== playerId);
    socket.leave(code);
    io.to(code).emit('lobby-players', lobbyPlayers[code]);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

// ✅ Keepalive/test route
app.get('/', (_, res) => {
  res.send('Super Flawed backend is running 🚀');
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

httpServer.listen(PORT, () => {
  console.log(`✅ Socket server listening on port ${PORT}`);
});