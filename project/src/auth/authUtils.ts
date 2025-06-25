// src/auth/authUtils.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth } from "../lib/firebase";
import axios from "axios";

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const getIdToken = async (forceRefresh = false) => {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    console.error("Error getting ID token:", error);
    return null;
  }
};

export const getFreshIdToken = async () => {
  return await getIdToken(true);
};

// Helper function to make authenticated API calls with automatic token refresh
export const makeAuthenticatedRequest = async (config: any, retryCount = 0): Promise<any> => {
  const user = auth.currentUser;
  if (!user) throw new Error("User not logged in");

  try {
    // Get token (fresh on retry)
    const idToken = await getIdToken(retryCount > 0);
    
    // Add authorization header
    const requestConfig = {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${idToken}`,
      },
    };

    return await axios(requestConfig);
  } catch (error: any) {
    // If token expired and this is the first try, retry with fresh token
    if (error.response?.status === 401 && retryCount === 0) {
      console.log("Token expired, retrying with fresh token...");
      return await makeAuthenticatedRequest(config, retryCount + 1);
    }
    throw error;
  }
};
