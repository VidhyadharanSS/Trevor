/**
 * Trevor — Recent Vaults
 *
 * Persists a small list of recently-opened vault paths in localStorage,
 * with last-opened timestamps so the switcher can sort them.
 */

const KEY = "trevor.recentVaults.v1";
const MAX = 8;

export interface RecentVault {
  path: string;
  name: string;
  openedAt: number;
}

export function getRecentVaults(): RecentVault[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentVault[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v) => v && typeof v.path === "string")
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function recordVaultOpen(path: string): void {
  const name = path.split(/[/\\]/).filter(Boolean).pop() ?? path;
  const all = getRecentVaults().filter((v) => v.path !== path);
  all.unshift({ path, name, openedAt: Date.now() });
  try {
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  } catch {
    /* localStorage full — ignore */
  }
}

export function removeRecentVault(path: string): void {
  const all = getRecentVaults().filter((v) => v.path !== path);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
