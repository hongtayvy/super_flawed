// app/src/socket.ts
import { io } from 'socket.io-client';

const URL = import.meta.env.PROD
  // NO :8080 here
  ? 'https://superflawed-production.up.railway.app'
  : 'http://localhost:4000';

export const socket = io(URL, {
  // no transports override → will use polling first, then WS if it ever works
  path: '/socket.io',
});

// add these so you can see exactly what’s happening
socket.on('connect', () => console.log('✅ WS connected'));
socket.on('connect_error', e => console.error('❌ WS error', e));