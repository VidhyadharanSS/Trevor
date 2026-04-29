/**
 * Trevor — Per-vault recent-notes history (back / forward navigation)
 *
 * A small bounded stack of recently-opened note paths, persisted to
 * localStorage so it survives reloads. Powers ⌘[ (back) and ⌘] (forward)
 * navigation, plus restoring the last-opened note when re-opening a vault.
 *
 * The stack is tracked per-vault to keep navigation contextual.
 */

const KEY_PREFIX = "trevor:noteHistory:v1:";
const LAST_NOTE_PREFIX = "trevor:lastNote:v1:";
const MAX_ENTRIES = 50;

interface State {
  /** Past entries (oldest first). The current note is at `cursor`. */
  stack: string[];
  /** Index into `stack` pointing at the currently-active note. */
  cursor: number;
}

function load(vault: string): State {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + vault);
    if (!raw) return { stack: [], cursor: -1 };
    const parsed = JSON.parse(raw) as State;
    if (
      Array.isArray(parsed.stack) &&
      typeof parsed.cursor === "number" &&
      parsed.cursor >= -1 &&
      parsed.cursor < parsed.stack.length
    ) {
      return parsed;
    }
  } catch {
    /* fall-through — corrupted entry */
  }
  return { stack: [], cursor: -1 };
}

function save(vault: string, state: State): void {
  try {
    localStorage.setItem(KEY_PREFIX + vault, JSON.stringify(state));
  } catch {
    /* localStorage quota / private mode — ignore */
  }
}

/** Mark `path` as visited. Trims any forward-history past the cursor. */
export function pushVisit(vault: string, path: string): void {
  if (!vault || !path) return;
  const state = load(vault);
  // No-op if we're already on this exact note.
  if (state.cursor >= 0 && state.stack[state.cursor] === path) return;
  // Drop forward history.
  state.stack = state.stack.slice(0, state.cursor + 1);
  state.stack.push(path);
  // Cap.
  while (state.stack.length > MAX_ENTRIES) state.stack.shift();
  state.cursor = state.stack.length - 1;
  save(vault, state);
  try { localStorage.setItem(LAST_NOTE_PREFIX + vault, path); } catch {}
}

/** Move back one step. Returns the new active path, or null if can't. */
export function navigateBack(vault: string): string | null {
  const state = load(vault);
  if (state.cursor <= 0) return null;
  state.cursor -= 1;
  save(vault, state);
  const p = state.stack[state.cursor];
  try { localStorage.setItem(LAST_NOTE_PREFIX + vault, p); } catch {}
  return p;
}

/** Move forward one step. Returns the new active path, or null if can't. */
export function navigateForward(vault: string): string | null {
  const state = load(vault);
  if (state.cursor < 0 || state.cursor >= state.stack.length - 1) return null;
  state.cursor += 1;
  save(vault, state);
  const p = state.stack[state.cursor];
  try { localStorage.setItem(LAST_NOTE_PREFIX + vault, p); } catch {}
  return p;
}

/** Whether back / forward are currently possible. */
export function canNavigate(vault: string): { back: boolean; forward: boolean } {
  const state = load(vault);
  return {
    back: state.cursor > 0,
    forward: state.cursor >= 0 && state.cursor < state.stack.length - 1,
  };
}

/** Remove all references to a path (used when a note is deleted). */
export function purgeFromHistory(vault: string, path: string): void {
  const state = load(vault);
  const filtered = state.stack.filter((p) => p !== path);
  if (filtered.length === state.stack.length) return;
  // Adjust cursor to the closest valid index ≤ original.
  state.cursor = Math.min(state.cursor, filtered.length - 1);
  state.stack = filtered;
  save(vault, state);
}

/** Rename a path everywhere in the history (used after rename / move). */
export function renameInHistory(vault: string, oldPath: string, newPath: string): void {
  const state = load(vault);
  let changed = false;
  for (let i = 0; i < state.stack.length; i++) {
    if (state.stack[i] === oldPath) {
      state.stack[i] = newPath;
      changed = true;
    }
  }
  if (changed) save(vault, state);
  try {
    if (localStorage.getItem(LAST_NOTE_PREFIX + vault) === oldPath) {
      localStorage.setItem(LAST_NOTE_PREFIX + vault, newPath);
    }
  } catch {}
}

/** Get the last-opened note for a vault (used to restore on app start). */
export function getLastNote(vault: string): string | null {
  if (!vault) return null;
  try {
    return localStorage.getItem(LAST_NOTE_PREFIX + vault);
  } catch {
    return null;
  }
}
