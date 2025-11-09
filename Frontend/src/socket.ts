import { io } from 'socket.io-client';

// Creating a socket connection to our Express server
export const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
});