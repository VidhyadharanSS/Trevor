/**
 * Trevor — Snippet Store
 *
 * Reusable text snippets keyed by trigger.  When the user types a
 * trigger followed by Tab (or selects from the autocomplete), the
 * snippet body replaces the trigger.  Bodies support these tokens:
 *
 *   {{date}}       — today's date (YYYY-MM-DD)
 *   {{time}}       — current time (HH:MM)
 *   {{datetime}}   — full ISO datetime
 *   {{cursor}}     — caret resting position after expansion
 *   {{title}}      — current note title (filename minus extension)
 *
 * Snippets are persisted to localStorage so users can ship their own
 * libraries.  A handful of useful defaults are bundled.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Snippet {
  id: string;
  trigger: string;     // e.g. ":date"
  description: string; // shown in the autocomplete
  body: string;        // text to insert (supports placeholders)
  builtin?: boolean;   // protected from deletion
}

interface SnippetState {
  snippets: Snippet[];
  add: (s: Omit<Snippet, "id">) => void;
  update: (id: string, patch: Partial<Snippet>) => void;
  remove: (id: string) => void;
  reset: () => void;
}

const DEFAULTS: Snippet[] = [
  {
    id: "builtin:date",
    trigger: ":date",
    description: "Insert today's date (YYYY-MM-DD)",
    body: "{{date}}",
    builtin: true,
  },
  {
    id: "builtin:time",
    trigger: ":time",
    description: "Insert current time",
    body: "{{time}}",
    builtin: true,
  },
  {
    id: "builtin:now",
    trigger: ":now",
    description: "Insert full datetime",
    body: "{{datetime}}",
    builtin: true,
  },
  {
    id: "builtin:meeting",
    trigger: ":meeting",
    description: "Meeting notes scaffold",
    body:
      "## Meeting — {{date}}\n\n" +
      "**Attendees:** {{cursor}}\n\n" +
      "### Agenda\n\n- \n\n### Decisions\n\n- \n\n### Action items\n\n- [ ] ",
    builtin: true,
  },
  {
    id: "builtin:todo",
    trigger: ":todo",
    description: "Empty checkbox",
    body: "- [ ] {{cursor}}",
    builtin: true,
  },
  {
    id: "builtin:cb",
    trigger: ":cb",
    description: "Code block scaffold",
    body: "```{{cursor}}\n\n```",
    builtin: true,
  },
  {
    id: "builtin:callout",
    trigger: ":info",
    description: "Info callout",
    body: "> [!INFO] Title\n> {{cursor}}",
    builtin: true,
  },
];

export const useSnippets = create<SnippetState>()(
  persist(
    (set) => ({
      snippets: DEFAULTS,
      add: (s) =>
        set((state) => ({
          snippets: [
            ...state.snippets,
            { ...s, id: `user:${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),
      update: (id, patch) =>
        set((state) => ({
          snippets: state.snippets.map((s) =>
            s.id === id ? { ...s, ...patch, id: s.id, builtin: s.builtin } : s,
          ),
        })),
      remove: (id) =>
        set((state) => ({
          // Built-in snippets cannot be deleted — only edited.
          snippets: state.snippets.filter((s) => s.id !== id || s.builtin),
        })),
      reset: () => set({ snippets: DEFAULTS }),
    }),
    {
      name: "trevor.snippets.v1",
      version: 1,
      // Always merge defaults so newly-shipped builtins appear after upgrade.
      merge: (persisted, current) => {
        const persistedSnips = (persisted as SnippetState | undefined)?.snippets ?? [];
        const existingIds = new Set(persistedSnips.map((s) => s.id));
        const merged = [
          ...persistedSnips,
          ...DEFAULTS.filter((d) => !existingIds.has(d.id)),
        ];
        return { ...current, snippets: merged } as SnippetState;
      },
    },
  ),
);

/** Expand placeholder tokens. Returns `{ text, cursorOffset }`. */
export function expandSnippet(
  body: string,
  ctx: { title?: string },
): { text: string; cursorOffset: number | null } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const datetime = now.toISOString();

  let text = body
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{datetime\}\}/g, datetime)
    .replace(/\{\{title\}\}/g, ctx.title ?? "");

  let cursorOffset: number | null = null;
  const cursorIdx = text.indexOf("{{cursor}}");
  if (cursorIdx >= 0) {
    cursorOffset = cursorIdx;
    text = text.slice(0, cursorIdx) + text.slice(cursorIdx + "{{cursor}}".length);
  }
  return { text, cursorOffset };
}

/** Find snippet matching a trigger string. */
export function findByTrigger(snippets: Snippet[], trigger: string): Snippet | null {
  return snippets.find((s) => s.trigger === trigger) ?? null;
}

/** Find snippets whose trigger starts with `query` (for autocomplete). */
export function findByPrefix(snippets: Snippet[], query: string): Snippet[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return snippets
    .filter((s) => s.trigger.toLowerCase().startsWith(q))
    .slice(0, 8);
}
