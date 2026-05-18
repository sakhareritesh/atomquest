"use client";

import { useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/hooks/use-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setFirebaseUid, setLoading, isAuthenticating } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setFirebaseUid(firebaseUser.uid);

        if (useAuthStore.getState().isAuthenticating) {
          return;
        }

        try {
          const res = await fetch("/api/auth/me", { credentials: "include" });
          if (res.ok) {
            const { user } = await res.json();
            if (user) {
              setUser(user);
            } else {
              setUser(null);
              setFirebaseUid(null);
              await signOut(auth).catch(() => {});
            }
          } else {
            setUser(null);
            setFirebaseUid(null);
            await signOut(auth).catch(() => {});
          }
        } catch {
          setUser(null);
          setFirebaseUid(null);
        }
      } else {
        setUser(null);
        setFirebaseUid(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setFirebaseUid, setLoading, isAuthenticating]);

  return <>{children}</>;
}
