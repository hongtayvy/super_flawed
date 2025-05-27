import { io } from 'socket.io-client';
const URL =
  import.meta.env.PROD
    ? 'https://superflawed-production.up.railway.app'
    : 'http://localhost:4000';

export const socket = io(URL, {
  transports: ['websocket'],  // ← no more polling
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error:', err);
});