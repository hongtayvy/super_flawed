// app/src/socket.ts
import { io } from 'socket.io-client';

const URL = import.meta.env.PROD
  // NO :8080 here
  ? 'https://superflawed-production.up.railway.app'
  : 'http://localhost:4000';

export const socket = io(URL, {
  transports: ['websocket'],  // WS only
  path: '/socket.io',         // match your server
});

// add these so you can see exactly what’s happening
socket.on('connect', () => console.log('✅ WS connected'));
socket.on('connect_error', e => console.error('❌ WS error', e));