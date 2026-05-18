import { initializeApp, getApps, cert, type ServiceAccount, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let _app: App | null = null;
let _auth: Auth | null = null;

function getAdminApp(): App {
  if (_app) return _app;

  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  _app = initializeApp({ credential: cert(serviceAccount) });
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
