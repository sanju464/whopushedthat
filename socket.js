import { io } from 'socket.io-client';

const isProduction = import.meta.env.PROD;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (isProduction ? 'https://whopushedthat.onrender.com' : 'http://localhost:3001');

const socket = io(BACKEND_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log(`[Socket] Connected to ${isProduction ? 'production' : 'local'} server:`, BACKEND_URL);
  console.log('[Socket] ID:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket] Disconnected. Reason:', reason);
});

socket.on('connect_error', (err) => {
  console.error('[Socket] Connection error:', err.message);
});

export default socket;
