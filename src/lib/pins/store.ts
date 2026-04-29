/**
 * Trevor — Pinned Notes
 *
 * A simple per-vault pinned-notes registry, persisted to localStorage.
 * Pinned notes float to the top of the sidebar in their own section.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PinsState {
  /** Map of vaultPath → ordered list of pinned note paths. */
  pins: Record<string, string[]>;
  togglePin: (vault: string, path: string) => void;
  isPinned: (vault: string, path: string) => boolean;
  pinsFor: (vault: string) => string[];
  /** Update path on rename. */
  renamePinned: (vault: string, oldPath: string, newPath: string) => void;
  /** Remove on delete. */
  removePinned: (vault: string, path: string) => void;
}

export const usePins = create<PinsState>()(
  persist(
    (set, get) => ({
      pins: {},
      togglePin: (vault, path) =>
        set((state) => {
          const list = state.pins[vault] ?? [];
          const next = list.includes(path)
            ? list.filter((p) => p !== path)
            : [path, ...list];
          return { pins: { ...state.pins, [vault]: next } };
        }),
      isPinned: (vault, path) => (get().pins[vault] ?? []).includes(path),
      pinsFor: (vault) => get().pins[vault] ?? [],
      renamePinned: (vault, oldPath, newPath) =>
        set((state) => {
          const list = state.pins[vault] ?? [];
          if (!list.includes(oldPath)) return state;
          return {
            pins: {
              ...state.pins,
              [vault]: list.map((p) => (p === oldPath ? newPath : p)),
            },
          };
        }),
      removePinned: (vault, path) =>
        set((state) => {
          const list = state.pins[vault] ?? [];
          if (!list.includes(path)) return state;
          return {
            pins: {
              ...state.pins,
              [vault]: list.filter((p) => p !== path),
            },
          };
        }),
    }),
    { name: "trevor.pins.v1", version: 1 },
  ),
);
