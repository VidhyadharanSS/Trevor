/**
 * Trevor — Note Version History
 *
 * Stores up to N (default 50) previous revisions of each note in
 * IndexedDB, keyed by note path.  Every save creates a snapshot
 * containing the previous content + a timestamp + a tiny "changed
 * lines" stat, then trims the history if it exceeds the cap.
 *
 * This is a deliberately simple LRU — full git-style branching is
 * out of scope; what users want is "undo a few hours back".
 */

const DB_NAME = "trevor-history-v1";
const STORE = "versions";
const VERSION = 1;
const MAX_PER_NOTE = 50;

export interface NoteVersion {
  id?: number;
  path: string;       // note path (key)
  content: string;    // snapshot of the content
  savedAt: number;    // epoch ms
  byteSize: number;   // length(content) for quick stats
  /** Diff stats vs prior version (heuristic): added, removed lines. */
  added: number;
  removed: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("byPath", "path", { unique: false });
        store.createIndex("byPathSavedAt", ["path", "savedAt"], { unique: false });
      }
    };
  });
  return dbPromise;
}

/**
 * Add a new version snapshot for a note.  Compares to the most recent
 * snapshot to compute a tiny "added/removed" stat for the UI.
 */
export async function pushVersion(path: string, content: string): Promise<void> {
  if (!path) return;
  // Skip recording empty content.
  if (!content || content.trim() === "") return;
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  // Look up most recent version to compute diff stats and dedupe.
  const recent = await getMostRecent(store, path);
  if (recent && recent.content === content) return; // no-op save
  const stats = recent ? diffLineStats(recent.content, content) : { added: lineCount(content), removed: 0 };

  const version: NoteVersion = {
    path,
    content,
    savedAt: Date.now(),
    byteSize: content.length,
    added: stats.added,
    removed: stats.removed,
  };
  store.add(version);

  // Trim oldest if over cap.
  await trim(store, path, MAX_PER_NOTE);

  await txDone(tx);
}

/** Fetch all versions for a note, newest first. */
export async function getVersions(path: string): Promise<NoteVersion[]> {
  if (!path) return [];
  const db = await openDB();
  const tx = db.transaction(STORE, "readonly");
  const idx = tx.objectStore(STORE).index("byPath");
  const out: NoteVersion[] = [];
  return new Promise((resolve, reject) => {
    const req = idx.openCursor(IDBKeyRange.only(path));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        out.push(cursor.value as NoteVersion);
        cursor.continue();
      } else {
        out.sort((a, b) => b.savedAt - a.savedAt);
        resolve(out);
      }
    };
  });
}

/** Drop all versions for a path (used on note delete). */
export async function clearVersionsForPath(path: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const idx = tx.objectStore(STORE).index("byPath");
  return new Promise((resolve, reject) => {
    const req = idx.openCursor(IDBKeyRange.only(path));
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
  });
}

/** Rename versions when a note is renamed. */
export async function renameVersionPath(oldPath: string, newPath: string): Promise<void> {
  const versions = await getVersions(oldPath);
  if (versions.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const v of versions) {
    if (v.id !== undefined) store.delete(v.id);
    const { id: _drop, ...rest } = v;
    void _drop;
    store.add({ ...rest, path: newPath });
  }
  await txDone(tx);
}

/* ── Internal helpers ─────────────────────────────────────────────── */

async function getMostRecent(store: IDBObjectStore, path: string): Promise<NoteVersion | null> {
  return new Promise((resolve, reject) => {
    const idx = store.index("byPathSavedAt");
    const req = idx.openCursor(
      IDBKeyRange.bound([path, -Infinity], [path, Infinity]),
      "prev",
    );
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      resolve(cursor ? (cursor.value as NoteVersion) : null);
    };
  });
}

async function trim(store: IDBObjectStore, path: string, max: number): Promise<void> {
  // Count first; if over, delete oldest.
  return new Promise((resolve, reject) => {
    const idx = store.index("byPathSavedAt");
    const versions: NoteVersion[] = [];
    const req = idx.openCursor(
      IDBKeyRange.bound([path, -Infinity], [path, Infinity]),
    );
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        versions.push(cursor.value as NoteVersion);
        cursor.continue();
      } else {
        if (versions.length <= max) { resolve(); return; }
        // Delete the oldest excess.
        versions.sort((a, b) => a.savedAt - b.savedAt);
        const drop = versions.slice(0, versions.length - max);
        for (const v of drop) if (v.id !== undefined) store.delete(v.id);
        resolve();
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function lineCount(s: string): number { return s.split("\n").length; }

/**
 * Cheap diff stat: count lines unique to each side.  Not a real diff —
 * just enough to give the UI a "+12 / −3" badge.
 */
function diffLineStats(prev: string, next: string): { added: number; removed: number } {
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  for (const l of prev.split("\n")) a.set(l, (a.get(l) ?? 0) + 1);
  for (const l of next.split("\n")) b.set(l, (b.get(l) ?? 0) + 1);
  let added = 0, removed = 0;
  for (const [line, n] of b) {
    const inA = a.get(line) ?? 0;
    if (n > inA) added += n - inA;
  }
  for (const [line, n] of a) {
    const inB = b.get(line) ?? 0;
    if (n > inB) removed += n - inB;
  }
  return { added, removed };
}
