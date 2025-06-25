import { Server as IOServer, Socket } from "socket.io";
import { verifyFirebaseToken } from "../middleware/verifyToken";
import { db } from "../firebase";

interface AuthenticatedSocket extends Socket {
  user?: any;
}

export const setupSocketServer = (io: IOServer) => {
  // Middleware for socket authentication
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication token required"));
      }

      // Create a mock request object for token verification
      const mockReq = { headers: { authorization: `Bearer ${token}` } };
      const mockRes = {}; // Empty object since we'll handle errors differently
      
      await new Promise((resolve, reject) => {
        verifyFirebaseToken(mockReq as any, mockRes, (err?: any) => {
          if (err) {
            // Handle specific Firebase auth errors
            if (err.message.includes("expired")) {
              reject(new Error("Token expired. Please refresh and try again."));
            } else {
              reject(new Error("Authentication failed: " + err.message));
            }
          } else {
            socket.user = (mockReq as any).user;
            resolve(true);
          }
        });
      });

      next();
    } catch (error) {
      console.error("Socket authentication error:", error);
      // Pass the specific error message to the client
      next(error instanceof Error ? error : new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    console.log("✅ User connected:", socket.id, "User:", socket.user?.email);

    socket.on("join-room", async (roomId: string) => {
      try {
        socket.join(roomId);
        console.log(`${socket.user?.email} (${socket.id}) joined room ${roomId}`);

        // Add user to participants subcollection
        if (socket.user) {
          const participantData = {
            id: socket.user.uid,
            email: socket.user.email,
            displayName: socket.user.name || socket.user.displayName || null,
            joinedAt: new Date().toISOString(),
            permission: 'view', // Default permission for new participants
            isOnline: true,
            socketId: socket.id
          };

          await db
            .collection("rooms")
            .doc(roomId)
            .collection("participants")
            .doc(socket.user.uid)
            .set(participantData, { merge: true });

          // Notify room owner about new participant
          socket.to(roomId).emit("participant-joined", participantData);
        }
        
      } catch (error) {
        console.error("Error joining room:", error);
      }
    });

    socket.on("leave-room", async (roomId: string) => {
      try {
        socket.leave(roomId);
        console.log(`${socket.user?.email} (${socket.id}) left room ${roomId}`);

        // Update participant status to offline
        if (socket.user) {
          await db
            .collection("rooms")
            .doc(roomId)
            .collection("participants")
            .doc(socket.user.uid)
            .update({
              isOnline: false,
              leftAt: new Date().toISOString()
            });

          // Notify room about participant leaving
          socket.to(roomId).emit("participant-left", socket.user.uid);
        }
        
      } catch (error) {
        console.error("Error leaving room:", error);
      }
    });

    socket.on("canvas-update", ({ roomId, data }) => {
      // broadcast to others in room (excluding sender)
      socket.to(roomId).emit("receive-update", data);
      console.log(`Canvas update broadcasted to room ${roomId}`);
    });

    socket.on("permission-updated", ({ roomId, participantId, permission }) => {
      // Notify the specific participant about permission change
      socket.to(roomId).emit("participant-permission-updated", { participantId, permission });
      console.log(`Permission updated for ${participantId} in room ${roomId}: ${permission}`);
    });

    socket.on("disconnect", async () => {
      console.log("❌ User disconnected:", socket.id, socket.user?.email);
      
      // Update all participant records where this user was online
      if (socket.user) {
        try {
          const participantRefs = await db
            .collectionGroup("participants")
            .where("id", "==", socket.user.uid)
            .where("isOnline", "==", true)
            .get();

          const batch = db.batch();
          participantRefs.docs.forEach(doc => {
            batch.update(doc.ref, {
              isOnline: false,
              disconnectedAt: new Date().toISOString()
            });
          });
          await batch.commit();
        } catch (error) {
          console.error("Error updating participant status on disconnect:", error);
        }
      }
    });
  });
};
