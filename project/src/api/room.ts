// src/api/room.ts
import axios from "axios";
import { auth } from "../lib/firebase";
import LZString from "lz-string";

export const saveRoom = async (roomData: {
  roomName: string;
  isPublic: boolean;
  password?: string;
  canvasData: object;
}) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const idToken = await user.getIdToken();

  // Compress canvas data and encode to Base64 to ensure safe storage
  const compressedCanvasData = LZString.compressToBase64(JSON.stringify(roomData.canvasData));
  console.log('🔧 Compressed canvas data (Base64):', compressedCanvasData?.substring(0, 100) + '...');

  const response = await axios.post(
    `${import.meta.env.VITE_BACKEND_URL}/rooms/create`,
    {
      ...roomData,
      canvasData: compressedCanvasData,
      isCompressed: true
    },
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  return response.data; // returns { roomId: string }
};

export const joinRoom = async (joinData: {
  roomId: string;
  isPublic: boolean;
  password?: string;
}) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const idToken = await user.getIdToken();

  const response = await axios.post(
    `${import.meta.env.VITE_BACKEND_URL}/rooms/join`,
    joinData,
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  const data = response.data;
    // Handle canvas data decompression/parsing (same logic as loadRoom)
  if (data.canvasData) {
    try {
      // If it's marked as compressed, decompress it
      if (data.isCompressed && typeof data.canvasData === 'string') {
        console.log('🔧 Attempting to decompress Base64 canvas data...');
        const decompressedData = LZString.decompressFromBase64(data.canvasData);
        if (decompressedData) {
          data.canvasData = JSON.parse(decompressedData);
          console.log('✅ Canvas data decompressed successfully');
        } else {
          console.log('❌ Base64 decompression failed, trying as regular JSON string');
          // Fallback: try parsing as regular JSON string
          data.canvasData = JSON.parse(data.canvasData);
        }
      } 
      // If it's a string but not marked as compressed, try parsing as JSON
      else if (typeof data.canvasData === 'string') {
        data.canvasData = JSON.parse(data.canvasData);
      }
      // If it's already an object, use as-is
    } catch (error) {
      console.error('Error processing canvas data in joinRoom:', error);
      data.canvasData = null;
    }
  }

  return data; // returns processed room data
};

export const updateRoom = async (roomId: string, canvasData: object) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const idToken = await user.getIdToken();

  // Compress canvas data and encode to Base64 to ensure safe storage
  const compressedCanvasData = LZString.compressToBase64(JSON.stringify(canvasData));
  console.log('🔧 Updating room with compressed data (Base64):', compressedCanvasData?.substring(0, 100) + '...');

  const response = await axios.put(
    `${import.meta.env.VITE_BACKEND_URL}/rooms/${roomId}`,
    { canvasData: compressedCanvasData, isCompressed: true },
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    }
  );

  return response.data;
};


export const loadRoom = async (roomId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const token = await user.getIdToken();

  const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/rooms/${roomId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = res.data;
  
  console.log('🔍 Raw room data from backend:', data);
  console.log('🔍 Canvas data type:', typeof data.canvasData);
  console.log('🔍 Is compressed flag:', data.isCompressed);
    // Handle canvas data decompression/parsing
  if (data.canvasData) {
    try {
      // If it's marked as compressed, decompress it
      if (data.isCompressed && typeof data.canvasData === 'string') {
        console.log('� Attempting to decompress Base64 canvas data...');
        console.log('🔍 Raw compressed data (first 100 chars):', data.canvasData.substring(0, 100));
        const decompressedData = LZString.decompressFromBase64(data.canvasData);
        if (decompressedData) {
          data.canvasData = JSON.parse(decompressedData);
          console.log('✅ Canvas data decompressed successfully');
        } else {
          console.log('❌ Base64 decompression failed, trying legacy decompress method');
          // Try legacy decompress method for backward compatibility
          const legacyDecompressed = LZString.decompress(data.canvasData);
          if (legacyDecompressed) {
            data.canvasData = JSON.parse(legacyDecompressed);
            console.log('✅ Legacy decompression successful');
          } else {
            console.log('❌ All decompression methods failed, trying as regular JSON string');
            data.canvasData = JSON.parse(data.canvasData);
          }
        }
      } 
      // If it's a string but not marked as compressed, try parsing as JSON
      else if (typeof data.canvasData === 'string') {
        console.log('🔍 Parsing canvas data as JSON string...');
        data.canvasData = JSON.parse(data.canvasData);
        console.log('✅ Canvas data parsed as JSON successfully');
      }
      // If it's already an object, use as-is
      else if (typeof data.canvasData === 'object') {
        console.log('✅ Canvas data is already an object, using as-is');
      }
      
      console.log('🔍 Final canvas data structure:', Object.keys(data.canvasData || {}));
    } catch (error) {
      console.error('❌ Error processing canvas data:', error);
      console.error('❌ Raw canvas data:', data.canvasData);
      data.canvasData = null;
    }
  } else {
    console.log('ℹ️ No canvas data found in room');
  }

  return data; // includes processed canvasData
};

export const getUserRooms = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const token = await user.getIdToken();

  const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/rooms/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  console.log('🔍 User rooms data:', response.data);
  return response.data;
};

export const getRoomParticipants = async (roomId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const token = await user.getIdToken();

  const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/rooms/${roomId}/participants`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

export const updateParticipantPermission = async (roomId: string, participantId: string, permission: 'edit' | 'view') => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const token = await user.getIdToken();

  const response = await axios.put(
    `${import.meta.env.VITE_BACKEND_URL}/rooms/${roomId}/participants/${participantId}`,
    { permission },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

export const getUserPermission = async (roomId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  const token = await user.getIdToken();

  const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/rooms/${roomId}/my-permission`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

