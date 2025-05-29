// 📁 server/index.ts
// Add player joins & session-persistent game state

import session from 'express-session';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = ['https://teal-beignet-5557d3.netlify.app'];

app.use(cors({ origin: allowedOrigins, credentials: true }));

// ✅ Add session middleware
app.use(session({
  secret: 'superflawed-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // ⚠️ for production, set secure: true over HTTPS
}));

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
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
}

interface CardSubmission {
  playerId: string;
  card: CardType;
}

interface GameState {
  players: PlayerType[];
  submissions: CardSubmission[];
  chat: any[];
  scores: Record<string, number>;
  hands: Record<string, CardType[]>;
}

const games: Record<string, GameState> = {};

// ✅ Player joins with session support
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join-room', ({ gameCode, player }: { gameCode: string; player: PlayerType }) => {
    const code = gameCode.toLowerCase();
    if (!games[code]) {
      games[code] = {
        players: [], submissions: [], chat: [], scores: {}, hands: {}
      };
    }

    const existing = games[code].players.find(p => p.id === player.id);
    if (!existing) {
      games[code].players.push(player);
      games[code].scores[player.id] = 0;
    }

    socket.join(code);
    io.to(code).emit('lobby-players', games[code].players);
  });

  socket.on('submit-card', ({ gameCode, submission }) => {
    const code = gameCode.toLowerCase();
    const existing = games[code].submissions.findIndex(s => s.playerId === submission.playerId);

    if (existing !== -1) {
      games[code].submissions[existing] = submission;
    } else {
      games[code].submissions.push(submission);
    }

    io.to(code).emit('update-submissions', games[code].submissions);
  });

  socket.on('start-round', ({ gameCode, round, hands, scores }) => {
    const code = gameCode.toLowerCase();
    if (!games[code]) return;

    games[code].hands = hands;
    games[code].scores = scores;
    games[code].submissions = []; // reset

    io.to(code).emit('start-round', { round, hands, scores });
  });

  socket.on('update-winner', ({ gameCode, winner }) => {
    const code = gameCode.toLowerCase();
    if (!games[code]) return;

    games[code].scores[winner.playerId] = (games[code].scores[winner.playerId] || 0) + 1;
    io.to(code).emit('update-winner', winner);
  });
});

app.get('/', (_, res) => {
  res.send('🟢 Super Flawed backend active');
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
httpServer.listen(PORT, () => {
  console.log(`✅ Listening on port ${PORT}`);
});