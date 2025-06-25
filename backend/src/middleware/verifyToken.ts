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
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (!decodedToken) {
      return res.status(401).json({ error: "Invalid token" });
    }
    (req as any).user = decodedToken; // attach user info to request
    next();
  } catch (err) {
    console.error("Token verification failed:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
