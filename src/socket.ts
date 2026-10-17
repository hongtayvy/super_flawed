import { io } from 'socket.io-client';

export const SERVER_URL = import.meta.env.PROD
  ? 'https://super-flawed.onrender.com'
  : 'http://localhost:4000';

export const socket = io(SERVER_URL, { path: '/socket.io' });

socket.on('connect_error', (err) => {
  console.error('WS connection error:', err.message);
});
