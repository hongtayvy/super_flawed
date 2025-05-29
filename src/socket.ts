// app/src/socket.ts
import { io } from 'socket.io-client';

const URL = import.meta.env.PROD
  ? 'https://superflawed-production.up.railway.app'
  : 'http://localhost:4000';

export const socket = io(URL, {
  path: '/socket.io',
  withCredentials: true, // 🔥 required for session-based connections
});

// Helpful debugging
socket.on('connect', () => console.log('✅ WS connected'));
socket.on('connect_error', (err) => {
  console.error('❌ WS connection error:', err.message);
});