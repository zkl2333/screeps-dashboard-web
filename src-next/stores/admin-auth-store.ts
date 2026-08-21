"use client";

import { create } from "zustand";

interface AdminAuthState {
  authenticated: boolean | null;
  setAuthenticated: (authenticated: boolean) => void;
}

export const useAdminAuthStore = create<AdminAuthState>()((set) => ({
  authenticated: null,
  setAuthenticated: (authenticated) => set({ authenticated }),
}));
