import "server-only";
import { cert, getApps, initializeApp, App, ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function cleanEnv(value: string | undefined) {
  if (!value) return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function getFirebaseServiceAccount(): ServiceAccount {
  const jsonKey = cleanEnv(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  if (jsonKey) {
    try {
      const parsed = JSON.parse(jsonKey) as ServiceAccount;
      if (parsed.privateKey?.includes("\\n")) {
        parsed.privateKey = parsed.privateKey.replace(/\\n/g, "\n");
      }
      if (typeof parsed.privateKey === "string") {
        parsed.privateKey = cleanEnv(parsed.privateKey);
      }
      return parsed;
    } catch {
      // Fallback to split env vars when FIREBASE_SERVICE_ACCOUNT_KEY exists but is malformed.
    }
  }

  const projectId = cleanEnv(process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const clientEmail = cleanEnv(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = cleanEnv(process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are missing. Configure FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.");
  }

  return { projectId, clientEmail, privateKey };
}

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: cert(getFirebaseServiceAccount()),
  });
} else {
  app = getApps()[0] as App;
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
