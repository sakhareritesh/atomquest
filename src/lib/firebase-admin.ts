import { initializeApp, getApps, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let _app: App | null = null;
let _auth: Auth | null = null;

const ADMIN_APP_NAME = "goal-portal-admin";

function getAdminApp(): App {
  if (_app) return _app;

  const existing = getApps().find((a) => a.name === ADMIN_APP_NAME);
  if (existing) {
    _app = existing;
    return _app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  const serviceAccount: ServiceAccount = { projectId, clientEmail, privateKey };

  _app = initializeApp({ credential: cert(serviceAccount) }, ADMIN_APP_NAME);
  return _app;
}

function getAdminAuth(): Auth {
  if (_auth) return _auth;
  _auth = getAuth(getAdminApp());
  return _auth;
}

export const adminAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    const auth = getAdminAuth();
    const value = (auth as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      return value.bind(auth);
    }
    return value;
  },
});
