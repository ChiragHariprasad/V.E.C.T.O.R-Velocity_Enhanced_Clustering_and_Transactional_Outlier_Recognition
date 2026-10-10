import { io } from 'socket.io-client';
import { SOCKET_URL } from './config/api';

// Creating a socket connection to Express server with automatic origin resolution in production
export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 10000
});