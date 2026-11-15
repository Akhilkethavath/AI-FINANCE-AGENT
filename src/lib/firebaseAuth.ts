import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function ensureAuth(): Auth {
  if (!firebaseApp) {
    firebaseApp =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey: firebaseConfig.apiKey,
            authDomain: firebaseConfig.authDomain,
            projectId: firebaseConfig.projectId,
            storageBucket: firebaseConfig.storageBucket,
            messagingSenderId: firebaseConfig.messagingSenderId,
            appId: firebaseConfig.appId,
          });
  }
  if (!firebaseAuth) {
    firebaseAuth = getAuth(firebaseApp);
  }
  return firebaseAuth;
}

export function initFirebaseAuthListener(): () => void {
  try {
    const auth = ensureAuth();
    return onAuthStateChanged(auth, () => {
      // Auth state listener kept active for session synchronization
    });
  } catch {
    return () => {};
  }
}

export async function signInWithGooglePopup(): Promise<{
  uid: string;
  name: string;
  email: string;
}> {
  const auth = ensureAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    if (!user.email) {
      throw new Error("Google account did not provide an email address.");
    }
    return {
      uid: user.uid,
      name: user.displayName || user.email.split("@")[0] || "Account Holder",
      email: user.email.toLowerCase(),
    };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? "";
    if (code === "auth/popup-closed-by-user") {
      throw new Error("Google sign-in popup was closed before finishing.");
    }
    if (code === "auth/popup-blocked") {
      throw new Error("Popup was blocked by the browser. Allow popups for this site to choose your Google account.");
    }
    if (code === "auth/unauthorized-domain") {
      throw new Error(
        "This domain is not authorized in Firebase Auth. Please sign in with email or check Firebase authorized domains.",
      );
    }
    throw err instanceof Error
      ? err
      : new Error("Google sign-in failed. Please try again.");
  }
}

export async function signOutGoogle(): Promise<void> {
  try {
    const auth = ensureAuth();
    await signOut(auth);
  } catch {
    // ignore sign-out errors if not signed in via Firebase
  }
}
