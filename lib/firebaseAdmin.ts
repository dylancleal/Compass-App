// Server-only — do not import in client components.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

let messagingClient: Messaging | null = null;

export function getFcm(): Messaging {
  if (messagingClient) return messagingClient;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Env vars can't hold literal newlines cleanly, so the private key is
  // stored with escaped "\n" sequences and unescaped here.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("Firebase not configured");

  const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  messagingClient = getMessaging(app);
  return messagingClient;
}
