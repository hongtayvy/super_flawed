// 📁 server/src/index.ts
import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { Room } from './room';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  'https://superflawed.netlify.app', // production frontend
  'https://6880424d6dd5960008c088c6--superflawed.netlify.app', // Netlify preview
  'http://localhost:5173', // dev
  'https://super-flawed.victor-yang.workers.dev', // Cloudflare
  'https://superflawed.com',
  'https://www.superflawed.com',
];

app.use(cors({ origin: allowedOrigins }));

const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

const rooms = new Map<string, Room>();

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalizeCode = (code: unknown) => String(code ?? '').trim().toUpperCase();

const newCode = () => {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
};

const cleanName = (name: unknown) => String(name ?? '').trim().slice(0, 20);
const cleanAvatar = (avatar: unknown) => (/^[0-7]$/.test(String(avatar)) ? String(avatar) : '0');

type Ack = (res: { ok: boolean; error?: string; gameCode?: string; playerId?: string }) => void;
const ackOf = (ack: unknown): Ack => (typeof ack === 'function' ? (ack as Ack) : () => {});

// The socket's identity is set on join and trusted from then on. Clients never
// get to claim a player ID in later events.
const identify = (socket: Socket): { room: Room; playerId: string } | null => {
  const { code, playerId } = socket.data as { code?: string; playerId?: string };
  const room = code ? rooms.get(code) : undefined;
  if (!room || !playerId || !room.players.has(playerId)) return null;
  room.lastActivity = Date.now();
  return { room, playerId };
};

io.on('connection', (socket) => {
  socket.on('create-room', (payload, ack) => {
    const reply = ackOf(ack);
    const name = cleanName(payload?.player?.name);
    if (!name) return reply({ ok: false, error: 'Enter a name.' });

    const code = newCode();
    // The last human left: close the room.
    const room = new Room(code, io, () => rooms.delete(code));
    rooms.set(room.code, room);
    const host = room.addPlayer(name, cleanAvatar(payload?.player?.avatar), true);

    socket.data = { code: room.code, playerId: host.id };
    room.attach(host.id, socket.id);
    reply({ ok: true, gameCode: room.code, playerId: host.id });
  });

  // Handles first join and reconnect: a known playerId re-attaches existing state.
  socket.on('join-room', (payload, ack) => {
    const reply = ackOf(ack);
    const code = normalizeCode(payload?.gameCode);
    const room = rooms.get(code);
    if (!room) return reply({ ok: false, error: 'Room not found.' });

    let player = typeof payload?.playerId === 'string' ? room.players.get(payload.playerId) : undefined;
    if (!player) {
      if (room.phase !== 'lobby') return reply({ ok: false, error: 'That game has already started.' });
      if (room.players.size >= config.maxPlayers) return reply({ ok: false, error: 'That room is full.' });
      const name = cleanName(payload?.player?.name);
      if (!name) return reply({ ok: false, error: 'Enter a name.' });
      player = room.addPlayer(name, cleanAvatar(payload?.player?.avatar), false);
    }

    socket.data = { code, playerId: player.id };
    room.attach(player.id, socket.id);
    reply({ ok: true, gameCode: code, playerId: player.id });
  });

  socket.on('player-ready', ({ isReady }) => {
    const ctx = identify(socket);
    if (ctx) ctx.room.setReady(ctx.playerId, Boolean(isReady));
  });

  socket.on('toggle-bots', () => {
    const ctx = identify(socket);
    if (ctx) ctx.room.toggleBots(ctx.playerId);
  });

  socket.on('set-timer', ({ seconds }) => {
    const ctx = identify(socket);
    if (ctx) ctx.room.setTimerSeconds(ctx.playerId, Number(seconds));
  });

  socket.on('start-game', (_payload, ack) => {
    const ctx = identify(socket);
    const reply = ackOf(ack);
    if (!ctx) return reply({ ok: false, error: 'Not in a room.' });
    const error = ctx.room.start(ctx.playerId);
    reply(error ? { ok: false, error } : { ok: true });
  });

  const action = (event: string, run: (room: Room, playerId: string, payload: any) => string | null) => {
    socket.on(event, (payload, ack) => {
      const ctx = identify(socket);
      const reply = ackOf(ack);
      if (!ctx) return reply({ ok: false, error: 'Not in a room.' });
      const error = run(ctx.room, ctx.playerId, payload ?? {});
      reply(error ? { ok: false, error } : { ok: true });
    });
  };

  action('reveal-power', (room, id) => room.revealPower(id));
  action('set-wildcard', (room, id, p) => room.setWildcard(id, p.text));
  action('submit-card', (room, id, p) => room.submit(id, String(p.cardId)));
  action('choose-cards', (room, id, p) => room.chooseCards(id, p.picks));
  action('vote', (room, id, p) => room.vote(id, String(p.entryId)));
  action('pick-winner', (room, id, p) => room.pickWinner(id, String(p.entryId)));
  action('pick-target', (room, id, p) => room.pickTarget(id, String(p.targetId)));
  action('play-again', (room, id) => {
    room.playAgain(id);
    return null;
  });

  socket.on('leave-room', () => {
    const ctx = identify(socket);
    if (!ctx) return;
    ctx.room.leave(ctx.playerId);
    socket.data = {};
  });

  socket.on('disconnect', () => {
    const ctx = identify(socket);
    if (ctx) ctx.room.detach(socket.id);
  });
});

// Drop rooms nobody has been connected to for a long while.
setInterval(() => {
  for (const [code, room] of rooms) {
    if (!room.hasConnectedHumans && Date.now() - room.lastActivity > config.roomIdleMs) {
      room.dispose();
      rooms.delete(code);
    }
  }
}, 5 * 60 * 1000).unref();

app.get('/', (_, res) => {
  res.send('🟢 Super Flawed backend active');
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
httpServer.listen(PORT, () => {
  console.log(`✅ Listening on port ${PORT}`);
});
