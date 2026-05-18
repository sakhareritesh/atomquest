"use client";

import { create } from "zustand";
import type { AuthState } from "@/types";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUid: null,
  loading: true,
  isAuthenticating: false,
  setUser: (user) => set({ user }),
  setFirebaseUid: (uid) => set({ firebaseUid: uid }),
  setLoading: (loading) => set({ loading }),
  setIsAuthenticating: (isAuthenticating) => set({ isAuthenticating }),
  logout: () => set({ user: null, firebaseUid: null, loading: false, isAuthenticating: false }),
}));
