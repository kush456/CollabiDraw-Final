// src/lib/socket.ts
import { io } from "socket.io-client";

const socket = io(`${import.meta.env.VITE_BACKEND_URL}`, {
  transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
  timeout: 20000,
  forceNew: true,
});

// Add connection event listeners for debugging
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

export default socket;
