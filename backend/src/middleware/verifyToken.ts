import { Request, Response, NextFunction } from "express";
import { adminAuth } from "../firebase";

// Middleware to verify Firebase ID token
export async function verifyFirebaseToken(
  req: any,
  res: any,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  console.log("Authorization header:", authHeader);
  
  if (!authHeader?.startsWith("Bearer ")) {
    const error = new Error("Missing or malformed token");
    // Check if this is being used in Socket.IO context (mock res object)
    if (typeof res.status !== 'function') {
      return next(error);
    }
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (!decodedToken) {
      const error = new Error("Invalid token");
      // Check if this is being used in Socket.IO context (mock res object)
      if (typeof res.status !== 'function') {
        return next(error);
      }
      return res.status(401).json({ error: "Invalid token" });
    }
    (req as any).user = decodedToken; // attach user info to request
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    const error = new Error("Invalid or expired token");
    // Check if this is being used in Socket.IO context (mock res object)
    if (typeof res.status !== 'function') {
      return next(error);
    }
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
