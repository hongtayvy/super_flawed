import { io } from 'socket.io-client';

const URL = import.meta.env.PROD
  ? 'https://super-flawed.onrender.com'
  : 'http://localhost:4000';

export const socket = io(URL, { path: '/socket.io' });

socket.on('connect_error', (err) => {
  console.error('WS connection error:', err.message);
});
