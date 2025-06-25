// src/lib/socket.ts
import { io } from "socket.io-client";
import { getFreshIdToken } from "../auth/authUtils";

const socket = io(`${import.meta.env.VITE_BACKEND_URL}`, {
  transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
  timeout: 20000,
  forceNew: true,
  autoConnect: false, // Don't auto-connect, we'll handle authentication first
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
  
  // If the error is related to token expiration, try to refresh the token
  if (error.message.includes('expired') || error.message.includes('Token expired')) {
    console.log('Token expired, attempting to refresh...');
    refreshTokenAndReconnect();
  }
});

// Function to refresh token and reconnect
const refreshTokenAndReconnect = async () => {
  try {
    const freshToken = await getFreshIdToken();
    if (freshToken) {
      socket.auth = { token: freshToken };
      console.log('Token refreshed, attempting to reconnect...');
      socket.connect();
    } else {
      console.error('Failed to get fresh token - user may need to login again');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
  }
};

export default socket;
