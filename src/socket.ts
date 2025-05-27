import { io } from 'socket.io-client';

const URL = import.meta.env.PROD
  // include port 8080 on prod
  ? 'https://superflawed-production.up.railway.app:8080'
  : 'http://localhost:4000';

export const socket = io(URL, {
  transports: ['websocket'],  // WebSocket only
  path: '/socket.io',         // defaults to /socket.io but safe to be explicit
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error:', err);
});
