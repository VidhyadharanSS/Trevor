/**
 * Trevor — Vault Store (Phase 2)
 *
 * Full state management with CRUD operations for notes and folders.
 * Supports create, delete, rename, move operations + search.
 */

import { createContext, useContext } from "react";
import type { FileEntry, Note } from "../fs/types";

// ── State ──────────────────────────────────────────

export interface VaultState {
  /** Root vault path (null = no vault selected) */
  vaultPath: string | null;
  /** Full directory tree of the vault */
  tree: FileEntry[];
  /** Currently selected folder path */
  selectedFolder: string | null;
  /** Notes in the selected folder */
  notes: Note[];
  /** Currently open note path */
  activeNotePath: string | null;
  /** Content of the active note */
  activeNoteContent: string;
  /** Whether a vault is being loaded */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Note list collapsed state */
  noteListCollapsed: boolean;
  /** Search query */
  searchQuery: string;
  /** Search results */
  searchResults: Note[];
  /** Is searching */
  isSearching: boolean;
  /** Expanded folder paths in sidebar */
  expandedFolders: Set<string>;
  /** Drag source path for move operations */
  dragSourcePath: string | null;
}

export const initialVaultState: VaultState = {
  vaultPath: null,
  tree: [],
  selectedFolder: null,
  notes: [],
  activeNotePath: null,
  activeNoteContent: "",
  isLoading: false,
  error: null,
  sidebarCollapsed: false,
  noteListCollapsed: false,
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  expandedFolders: new Set<string>(),
  dragSourcePath: null,
};

// ── Actions ────────────────────────────────────────

export type VaultAction =
  | { type: "SET_VAULT"; path: string; tree: FileEntry[] }
  | { type: "SET_TREE"; tree: FileEntry[] }
  | { type: "SELECT_FOLDER"; path: string; notes: Note[] }
  | { type: "OPEN_NOTE"; path: string; content: string }
  | { type: "UPDATE_NOTE_CONTENT"; content: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "TOGGLE_NOTE_LIST" }
  | { type: "CLOSE_NOTE" }
  | { type: "RESET" }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_SEARCH_RESULTS"; results: Note[] }
  | { type: "SET_SEARCHING"; searching: boolean }
  | { type: "TOGGLE_FOLDER"; path: string }
  | { type: "EXPAND_FOLDER"; path: string }
  | { type: "SET_DRAG_SOURCE"; path: string | null }
  | { type: "UPDATE_NOTE_PATH"; oldPath: string; newPath: string };

// ── Reducer ────────────────────────────────────────

export function vaultReducer(
  state: VaultState,
  action: VaultAction
): VaultState {
  switch (action.type) {
    case "SET_VAULT": {
      const expanded = new Set<string>();
      expanded.add(action.path);
      return {
        ...state,
        vaultPath: action.path,
        tree: action.tree,
        selectedFolder: action.path,
        isLoading: false,
        error: null,
        expandedFolders: expanded,
      };
    }
    case "SET_TREE":
      return { ...state, tree: action.tree };
    case "SELECT_FOLDER":
      return {
        ...state,
        selectedFolder: action.path,
        notes: action.notes,
      };
    case "OPEN_NOTE":
      return {
        ...state,
        activeNotePath: action.path,
        activeNoteContent: action.content,
      };
    case "UPDATE_NOTE_CONTENT":
      return { ...state, activeNoteContent: action.content };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error, isLoading: false };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "TOGGLE_NOTE_LIST":
      return { ...state, noteListCollapsed: !state.noteListCollapsed };
    case "CLOSE_NOTE":
      return {
        ...state,
        activeNotePath: null,
        activeNoteContent: "",
      };
    case "RESET":
      return initialVaultState;
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query };
    case "SET_SEARCH_RESULTS":
      return { ...state, searchResults: action.results, isSearching: false };
    case "SET_SEARCHING":
      return { ...state, isSearching: action.searching };
    case "TOGGLE_FOLDER": {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(action.path)) {
        newExpanded.delete(action.path);
      } else {
        newExpanded.add(action.path);
      }
      return { ...state, expandedFolders: newExpanded };
    }
    case "EXPAND_FOLDER": {
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.add(action.path);
      return { ...state, expandedFolders: newExpanded };
    }
    case "SET_DRAG_SOURCE":
      return { ...state, dragSourcePath: action.path };
    case "UPDATE_NOTE_PATH":
      return {
        ...state,
        activeNotePath:
          state.activeNotePath === action.oldPath
            ? action.newPath
            : state.activeNotePath,
      };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────

export interface VaultContextValue {
  state: VaultState;
  dispatch: React.Dispatch<VaultAction>;
}

export const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return ctx;
}
