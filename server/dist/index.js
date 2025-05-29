"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 📁 server/index.ts
const express_session_1 = __importDefault(require("express-session"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const allowedOrigins = ['https://teal-beignet-5557d3.netlify.app'];
app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
app.use((0, express_session_1.default)({
    secret: 'superflawed-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true }
});
const games = {};
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);
    socket.on('join-room', ({ gameCode, player }, callback) => {
        const code = gameCode.toLowerCase();
        if (!games[code]) {
            games[code] = {
                players: [], submissions: [], chat: [], scores: {}, hands: {}
            };
        }
        const existing = games[code].players.find(p => p.id === player.id);
        if (!existing && player?.id && player?.name) {
            games[code].players.push(player);
            games[code].scores[player.id] = 0;
            console.log('Player', player.name, 'joined room', gameCode);
            console.log('[Server] Current players in room', code, games[code].players.map(p => p.name));
        }
        socket.join(code);
        io.to(code).emit('lobby-players', games[code].players);
        if (callback)
            callback(); // ✅ Acknowledge emit
    });
    socket.on('player-ready', ({ gameCode, playerId, isReady }) => {
        const code = gameCode.toLowerCase();
        if (!games[code])
            return;
        games[code].players = games[code].players.map(p => p.id === playerId ? { ...p, isReady } : p);
        io.to(code).emit('lobby-players', games[code].players);
    });
    socket.on('toggle-bots', ({ gameCode }) => {
        const code = gameCode.toLowerCase();
        if (!games[code])
            return;
        const bots = [
            { id: 'sean', name: 'Sean Jerubin', avatar: '2', isHost: false, score: 0, isReady: false, isBot: true },
            { id: 'rengo', name: 'Rengo Yang', avatar: '4', isHost: false, score: 0, isReady: false, isBot: true },
            { id: 'yeng', name: 'Yeng Chang', avatar: '3', isHost: false, score: 0, isReady: false, isBot: true },
            { id: 'tdawg', name: 'Tdawg Thao', avatar: '3', isHost: false, score: 0, isReady: false, isBot: true },
        ];
        const currentPlayers = games[code].players;
        const hasBots = currentPlayers.some(p => bots.map(b => b.id).includes(p.id));
        games[code].players = hasBots
            ? currentPlayers.filter(p => !p.isBot)
            : [...currentPlayers, ...bots];
        io.to(code).emit('lobby-players', games[code].players);
    });
    socket.on('start-game', ({ gameCode }) => {
        const code = gameCode.toLowerCase();
        if (!games[code])
            return;
        io.to(code).emit('game-started', { gameCode: code });
    });
    socket.on('submit-card', ({ gameCode, submission }) => {
        const code = gameCode.toLowerCase();
        const existing = games[code].submissions.findIndex(s => s.playerId === submission.playerId);
        if (existing !== -1) {
            games[code].submissions[existing] = submission;
        }
        else {
            games[code].submissions.push(submission);
        }
        io.to(code).emit('update-submissions', games[code].submissions);
    });
    socket.on('start-round', ({ gameCode, round, hands, scores }) => {
        const code = gameCode.toLowerCase();
        if (!games[code])
            return;
        games[code].hands = hands;
        games[code].scores = scores;
        games[code].submissions = [];
        io.to(code).emit('start-round', { round, hands, scores });
    });
    socket.on('update-winner', ({ gameCode, winner }) => {
        const code = gameCode.toLowerCase();
        if (!games[code])
            return;
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
