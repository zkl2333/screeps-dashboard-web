"use client";

import {create} from "zustand";
import {createJSONStorage, persist} from "zustand/middleware";

export type MapRendererMode = "official" | "optimized";
export type ConsoleSendMode = "enter" | "ctrlEnter";

interface SettingsState {
  refreshIntervalMs: number;
  mapRendererMode: MapRendererMode;
  consoleSendMode: ConsoleSendMode;
  setRefreshIntervalMs: (intervalMs: number) => void;
  setMapRendererMode: (mode: MapRendererMode) => void;
  setConsoleSendMode: (mode: ConsoleSendMode) => void;
}

const DEFAULT_REFRESH_INTERVAL_MS = 60_000;
const DEFAULT_MAP_RENDERER_MODE: MapRendererMode = "official";
const DEFAULT_CONSOLE_SEND_MODE: ConsoleSendMode = "enter";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      refreshIntervalMs: DEFAULT_REFRESH_INTERVAL_MS,
      mapRendererMode: DEFAULT_MAP_RENDERER_MODE,
      consoleSendMode: DEFAULT_CONSOLE_SEND_MODE,
      setRefreshIntervalMs: (intervalMs) => set({refreshIntervalMs: intervalMs}),
      setMapRendererMode: (mode) => set({mapRendererMode: mode}),
      setConsoleSendMode: (mode) => set({consoleSendMode: mode}),
    }),
    {
      name: "screeps-dashboard-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        refreshIntervalMs: state.refreshIntervalMs,
        mapRendererMode: state.mapRendererMode,
        consoleSendMode: state.consoleSendMode,
      }),
    }
  )
);

export const refreshIntervalValues = [30_000, 60_000, 120_000, 300_000] as const;
