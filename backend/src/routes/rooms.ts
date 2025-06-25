import { Router } from "express";
import { db } from "../firebase";   
import { verifyFirebaseToken } from "../middleware/verifyToken";
const router = Router();

router.post("/create", verifyFirebaseToken, async (req : any, res: any, next) => {
  try {
    console.log("Received request body:", req.body);
    const { canvasData, isPublic = false, roomName, password, isCompressed = false } = req.body;
    const user = (req as any).user;

    if (!canvasData) {
      console.log("Canvas data is required");
      return res.status(400).json({ error: "Canvas data is required" });
    }

    // Validate password for private rooms
    if (!isPublic && !password) {
      console.log("Password required for private room, isPublic:", isPublic, "password:", password);
      return res.status(400).json({ error: "Password is required for private rooms" });
    }

    const createdAt = new Date().toISOString();

    // Store canvas data as-is (already compressed from frontend if isCompressed=true)
    const roomDoc = await db.collection("rooms").add({
      owner: user.uid,
      roomName: roomName || 'Untitled Room',
      createdAt,
      isPublic,
      ...(isPublic ? {} : { password }), // Only include password field for private rooms
      canvasData, // Store compressed string directly
      isCompressed, // Flag to indicate if data is compressed
    });

    // Update the document to include the roomId
    await roomDoc.update({
      roomId: roomDoc.id
    });

    console.log("Room created successfully:", roomDoc.id);

    res.status(201).json({
      roomId: roomDoc.id,
      roomName: roomName || 'Untitled Room',
      owner: user.uid,
      createdAt,
      isPublic,
    });
  } catch (err) {
    console.error("Error creating room:", err);
    next(err);
  }
});

// ✅ Protected route: Join a room
router.post("/join", verifyFirebaseToken, async (req : any, res: any, next) => {
  try {
    console.log("Received join request body:", req.body);
    const { roomId, isPublic, password } = req.body;
    const user = (req as any).user;

    if (!roomId) {
      return res.status(400).json({ error: "Room ID is required" });
    }

    // Get the room from Firestore
    const doc = await db.collection("rooms").doc(roomId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Room not found" });
    }

    const roomData = doc.data();

    // Check if room type matches what user expects
    if (roomData?.isPublic !== isPublic) {
      return res.status(400).json({ 
        error: isPublic ? "This room is private" : "This room is public" 
      });
    }

    // Validate password for private rooms
    if (!isPublic && roomData?.password !== password) {
      return res.status(401).json({ error: "Incorrect password" });
    }    console.log("User successfully joined room:", roomId);

    // Return room data (excluding password for security)
    const { password: _, ...safeRoomData } = roomData || {};
    
    // Return data as-is - decompression will be handled on frontend
    res.status(200).json({
      roomId,
      ...safeRoomData,
      message: "Successfully joined room"
    });
  } catch (err) {
    console.error("Error joining room:", err);
    next(err);
  }
});

// ✅ Protected route: Update a room's canvas data
router.put("/:roomId", verifyFirebaseToken, async (req : any, res: any, next) => {
  try {
    const { roomId } = req.params;
    const { canvasData, isCompressed = false } = req.body;
    const user = (req as any).user;

    if (!canvasData) {
      return res.status(400).json({ error: "Canvas data is required" });
    }

    // Get the room to check if user has permission to update
    const doc = await db.collection("rooms").doc(roomId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Room not found" });
    }

    const roomData = doc.data();

    // Check if user is the owner (you might want to add more permission logic here)
    if (roomData?.owner !== user.uid) {
      return res.status(403).json({ error: "You don't have permission to update this room" });
    }

    // Store canvas data as-is (already compressed from frontend if isCompressed=true)
    await db.collection("rooms").doc(roomId).update({
      canvasData, // Store compressed string directly
      isCompressed, // Flag to indicate if data is compressed
      lastModified: new Date().toISOString(),
      lastModifiedBy: user.uid,
    });

    res.status(200).json({
      message: "Room updated successfully",
      roomId,
    });
  } catch (err) {
    console.error("Error updating room:", err);
    next(err);
  }
});

// ✅ Protected route: Get user's rooms (MUST be before /:roomId route)
router.get("/user", verifyFirebaseToken, async (req : any, res : any, next) => {
  try {
    const user = (req as any).user;
    console.log("Fetching rooms for user:", user.uid);    // Get all rooms where user is the owner
    const userRoomsSnapshot = await db.collection("rooms")
      .where("owner", "==", user.uid)
      .get();

    const userRooms = userRoomsSnapshot.docs.map(doc => ({
      id: doc.id,
      roomId: doc.id,
      ...doc.data(),
      // Don't include password in response for security
      password: undefined
    }))
    // Sort by createdAt in descending order (newest first) on the server side
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    console.log("User rooms fetched successfully:", userRooms.length, "rooms found");
    res.status(200).json(userRooms);
  } catch (err) {
    console.error("Error fetching user rooms:", err);
    next(err);
  }
});

// ✅ Protected route: Load a whiteboard room
router.get("/:roomId", verifyFirebaseToken, async (req : any, res : any, next) => {
  try {
    const { roomId } = req.params;

    const doc = await db.collection("rooms").doc(roomId).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Room not found" });
    }

    const roomData = doc.data();
    
    // Return data as-is - decompression will be handled on frontend
    // This maintains backward compatibility with old uncompressed data
    res.status(200).json({
      roomId,
      ...roomData,
    });
  } catch (err) {
    next(err);
  }
});

// Get participants for a room (owner only)
router.get("/:roomId/participants", verifyFirebaseToken, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    const user = req.user;

    // Check if user is the room owner
    const roomDoc = await db.collection("rooms").doc(roomId).get();
    if (!roomDoc.exists) {
      return res.status(404).json({ error: "Room not found" });
    }

    const roomData = roomDoc.data();
    if (roomData?.owner !== user.uid) {
      return res.status(403).json({ error: "Only room owner can view participants" });
    }

    // Get participants from subcollection
    const participantsSnapshot = await db
      .collection("rooms")
      .doc(roomId)
      .collection("participants")
      .get();

    const participants = participantsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(participants);
  } catch (error) {
    console.error("Error fetching participants:", error);
    res.status(500).json({ error: "Failed to fetch participants" });
  }
});

// Update participant permission (owner only)
router.put("/:roomId/participants/:participantId", verifyFirebaseToken, async (req: any, res: any) => {
  try {
    const { roomId, participantId } = req.params;
    const { permission } = req.body;
    const user = req.user;

    if (!permission || !['edit', 'view'].includes(permission)) {
      return res.status(400).json({ error: "Valid permission required (edit or view)" });
    }

    // Check if user is the room owner
    const roomDoc = await db.collection("rooms").doc(roomId).get();
    if (!roomDoc.exists) {
      return res.status(404).json({ error: "Room not found" });
    }

    const roomData = roomDoc.data();
    if (roomData?.owner !== user.uid) {
      return res.status(403).json({ error: "Only room owner can update participant permissions" });
    }

    // Update participant permission
    await db
      .collection("rooms")
      .doc(roomId)
      .collection("participants")
      .doc(participantId)
      .update({
        permission,
        updatedAt: new Date().toISOString()
      });

    res.json({ success: true, participantId, permission });
  } catch (error) {
    console.error("Error updating participant permission:", error);
    res.status(500).json({ error: "Failed to update participant permission" });
  }
});

// Get current user's permission for a room
router.get("/:roomId/my-permission", verifyFirebaseToken, async (req: any, res: any) => {
  try {
    const { roomId } = req.params;
    const user = req.user;

    // Check if room exists
    const roomDoc = await db.collection("rooms").doc(roomId).get();
    if (!roomDoc.exists) {
      return res.status(404).json({ error: "Room not found" });
    }

    const roomData = roomDoc.data();
    
    // If user is the owner, they have edit permission
    if (roomData?.owner === user.uid) {
      return res.json({ permission: 'edit', isOwner: true });
    }

    // Get user's permission from participants subcollection
    const participantDoc = await db
      .collection("rooms")
      .doc(roomId)
      .collection("participants")
      .doc(user.uid)
      .get();

    if (participantDoc.exists) {
      const participantData = participantDoc.data();
      res.json({ 
        permission: participantData?.permission || 'view',
        isOwner: false
      });
    } else {
      // User is not a participant yet, default to view permission
      res.json({ permission: 'view', isOwner: false });
    }
  } catch (error) {
    console.error("Error fetching user permission:", error);
    res.status(500).json({ error: "Failed to fetch user permission" });
  }
});

export default router;
