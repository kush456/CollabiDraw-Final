import { initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import serviceAccount from "../serviceAccountKey.json";

const app = initializeApp({
  credential: cert(serviceAccount as ServiceAccount),
});

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
