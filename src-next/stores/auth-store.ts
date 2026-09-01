"use client";

import { create } from "zustand";
import type { ScreepsSession } from "../lib/screeps/types";

interface AuthState {
  session: ScreepsSession | null;
  setSession: (session: ScreepsSession) => void;
  patchSession: (patch: Partial<ScreepsSession>) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  patchSession: (patch) =>
    set((state) => ({
      session: state.session ? { ...state.session, ...patch } : null,
    })),
  clearSession: () => set({ session: null }),
}));
