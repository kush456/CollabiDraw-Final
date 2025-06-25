import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Room {
  id: string;
  roomId: string;
  roomName: string;
  isPublic: boolean;
  owner: string;
  createdAt: string;
  lastAccessed?: string;
  participants?: number;
}

interface RoomsState {
  recentRooms: Room[];
  userRooms: Room[];
  addRecentRoom: (room: Room) => void;
  updateRoomAccess: (roomId: string) => void;
  setUserRooms: (rooms: Room[]) => void;
  clearRooms: () => void;
}

export const useRoomsStore = create<RoomsState>()(
  persist(
    (set, get) => ({
      recentRooms: [],
      userRooms: [],
        addRecentRoom: (room: Room) => {
        const currentRooms = get().recentRooms;
        
        // Remove room if it already exists to avoid duplicates
        const filteredRooms = currentRooms.filter(r => r.roomId !== room.roomId);
        
        // Add new room at the beginning and limit to 10 recent rooms
        const updatedRooms = [
          { ...room, lastAccessed: room.lastAccessed || new Date().toISOString() },
          ...filteredRooms
        ].slice(0, 10);
        
        set({ recentRooms: updatedRooms });
      },
      
      updateRoomAccess: (roomId: string) => {
        const currentRooms = get().recentRooms;
        const updatedRooms = currentRooms.map(room => 
          room.roomId === roomId 
            ? { ...room, lastAccessed: new Date().toISOString() }
            : room
        );
        
        // Move accessed room to the top
        const accessedRoom = updatedRooms.find(r => r.roomId === roomId);
        if (accessedRoom) {
          const otherRooms = updatedRooms.filter(r => r.roomId !== roomId);
          set({ recentRooms: [accessedRoom, ...otherRooms] });
        }
      },
      
      setUserRooms: (rooms: Room[]) => {
        set({ userRooms: rooms });
      },
      
      clearRooms: () => {
        set({ recentRooms: [], userRooms: [] });
      },
    }),
    {
      name: 'rooms-storage',
      partialize: (state) => ({ 
        recentRooms: state.recentRooms,
        userRooms: state.userRooms 
      }),
    }
  )
);
