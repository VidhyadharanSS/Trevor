/**
 * Trevor — Mock File System Implementation (Phase 2)
 *
 * Complete in-memory file system for browser-based development.
 * Full support for nested folders, move operations, and proper path handling.
 */

import type { FileSystemAPI, FileEntry } from "./types";
import { joinPath, fileName } from "./types";

interface MockFile {
  content: string;
  isDirectory: boolean;
  modifiedAt: number;
  createdAt: number;
}

const SAMPLE_NOTES: Record<string, string> = {
  "/vault/Welcome to Trevor.md": `---
tags:
  - welcome
  - getting-started
  - trevor/intro
---

# Welcome to Trevor 🚀

Trevor is a lightning-fast, local-first note-taking app.

## Key Features

- **Local-first**: Your notes are plain \`.md\` files on your file system
- **Fast**: Instant startup, zero typing latency
- **Distraction-free**: Clean, focused writing environment
- **Linked thinking**: Connect notes with [[wiki-links]]

## Getting Started

1. Create a new note with \`Cmd+N\`
2. Organize with folders in the sidebar
3. Use \`Cmd+P\` for quick note switching
4. Link notes together with \`[[double brackets]]\`

> "The best note is one you can find again." — Trevor Philosophy

---

Check out [[Project Ideas]] and [[Daily Journal]] to see linking in action.
`,
  "/vault/Project Ideas.md": `# Project Ideas

## Active Projects

- [ ] Build a CLI tool for markdown linting
- [ ] Create a Rust library for [[wiki-links]] parsing
- [x] Set up Trevor development environment

## Backlog

- Design a graph visualization for note connections
- Implement PDF export with custom styling
- Add Mermaid.js diagram support

\`\`\`mermaid
graph TD
    A[Idea] --> B{Feasible?}
    B -->|Yes| C[Prototype]
    B -->|No| D[Archive]
    C --> E[Ship It]
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
    participant U as User
    participant T as Trevor
    participant FS as File System
    U->>T: Open note
    T->>FS: readFile()
    FS-->>T: content
    T-->>U: Render markdown
\`\`\`

## References

See also: [[Welcome to Trevor]] for app overview.
`,
  "/vault/Daily Journal.md": `# Daily Journal

## 2024-01-15

Today I set up **Trevor** and started organizing my notes. The local-first approach
feels right — no more worrying about cloud sync conflicts.

### What I learned
- ProseMirror has excellent extensibility
- Tailwind's dark mode is chef's kiss
- Rust + Tauri = tiny binary sizes

### Tomorrow
- [ ] Finish the sidebar component
- [ ] Test with large vaults (1000+ notes)
- [ ] Explore [[Canvas Mode]] ideas

---

## 2024-01-14

Started brainstorming the architecture. See [[Project Ideas]] for the full list.

> Focus on the writing experience first. Everything else is secondary.
`,
  "/vault/Recipes/Pasta Carbonara.md": `# Pasta Carbonara

## Ingredients

| Item | Amount |
|------|--------|
| Spaghetti | 400g |
| Guanciale | 200g |
| Egg yolks | 4 |
| Pecorino Romano | 100g |
| Black pepper | generous |

## Instructions

1. Boil pasta in salted water
2. Crisp the guanciale in a cold pan, slowly
3. Mix yolks + pecorino + pepper in a bowl
4. Toss drained pasta with guanciale
5. Off heat, add egg mixture. Toss vigorously.

> **Pro tip**: Never add cream. This is not *Alfredo*. 🇮🇹
`,
  "/vault/Recipes/Sourdough Bread.md": `# Sourdough Bread

A simple formula for a beautiful loaf.

## Formula

- **Flour**: 500g bread flour
- **Water**: 375g (75% hydration)
- **Starter**: 100g (active, bubbly)
- **Salt**: 10g

## Timeline

\`\`\`
09:00 — Mix & autolyse (30 min)
09:30 — Add starter + salt, mix
10:00 — Stretch & fold #1
10:30 — Stretch & fold #2
11:00 — Stretch & fold #3
14:00 — Pre-shape
14:30 — Final shape → banneton
14:45 — Refrigerate overnight
\`\`\`

Next morning: Bake at 250°C in Dutch oven, 20 min lid on, 20 min lid off.
`,
  "/vault/Recipes/Desserts/Tiramisu.md": `# Tiramisu

Classic Italian dessert — no baking required.

## Ingredients

- 6 egg yolks
- 250g mascarpone
- 500ml strong espresso (cooled)
- Savoiardi (ladyfinger biscuits)
- Unsweetened cocoa powder
- 2 tbsp Marsala wine (optional)

## Method

1. Whisk yolks with sugar until pale and thick
2. Fold in mascarpone gently
3. Dip ladyfingers briefly in espresso
4. Layer: biscuits → cream → biscuits → cream
5. Dust with cocoa powder
6. Refrigerate 4+ hours (overnight is best)

> The key is speed when dipping the ladyfingers — too long and they'll be soggy.
`,
  "/vault/Code Snippets/Rust Patterns.md": `# Rust Patterns

## Error Handling with \`thiserror\`

\`\`\`rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Permission denied")]
    PermissionDenied,
    #[error(transparent)]
    Io(#[from] std::io::Error),
}
\`\`\`

## Builder Pattern

\`\`\`rust
pub struct Config {
    pub port: u16,
    pub host: String,
}

impl Config {
    pub fn builder() -> ConfigBuilder {
        ConfigBuilder::default()
    }
}
\`\`\`

See also: [[Project Ideas]]
`,
  "/vault/Code Snippets/TypeScript Utils.md": `# TypeScript Utils

## Debounce Function

\`\`\`typescript
function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
\`\`\`

## Type-safe Event Emitter

\`\`\`typescript
type EventMap = Record<string, unknown>;

class TypedEmitter<T extends EventMap> {
  private listeners = new Map<keyof T, Set<Function>>();

  on<K extends keyof T>(event: K, fn: (data: T[K]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(fn);
  }

  emit<K extends keyof T>(event: K, data: T[K]) {
    this.listeners.get(event)?.forEach(fn => fn(data));
  }
}
\`\`\`
`,
  "/vault/Code Snippets/Web/React Hooks.md": `# React Hooks Patterns

## useLocalStorage

\`\`\`typescript
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
\`\`\`

## useDebounce

\`\`\`typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
\`\`\`

Related: [[TypeScript Utils]]
`,
  "/vault/Phase 4 Showcase.md": `---
tags:
  - showcase
  - trevor/phase-4
  - demo
---

# Phase 4 Showcase 🚀

This note demonstrates **declared tags** (above, in YAML frontmatter — rendered as the colourful pills at the top of this preview) versus **inline #hashtags** (rendered with a quieter outline style further down).

> [!INFO] Click the tag icon in the toolbar
> Or just look at the chip strip above the editor — you can add, remove, or promote tags from there.

## Tags — declared vs inline

The pills at the top of this note are **declared** in frontmatter — they survive renames, are searchable, and show up in the Tag Manager.

Inline tags like #productivity, #idea, and #trevor/inline are also indexed but rendered as quieter outline pills so you can tell them apart at a glance. Promote any of them to declared tags via the Tag Manager (⊕).

## Code blocks — comments are now distinct

Every comment line is rendered in italic, in a deliberately muted colour, so it stands apart from executable code:

\`\`\`typescript
// This is a single-line comment — should look italic + muted.
/* Block comments share the same treatment. */
/**
 * Doc-comments get a slightly accented tint so JSDoc / TSDoc stand out.
 * @param name  The user's display name.
 * @returns     A friendly greeting.
 */
export function greet(name: string): string {
  // String literals get a different colour.
  const prefix = "Hello";
  // Numbers are also distinct.
  const exclamationCount = 3;
  return \`\${prefix}, \${name}\${"!".repeat(exclamationCount)}\`;
}
\`\`\`

\`\`\`python
# Python comments — italic, muted.
def greet(name: str) -> str:
    """Doc-string — slightly accented."""
    prefix = "Hello"  # inline comment too
    return f"{prefix}, {name}!"
\`\`\`

\`\`\`rust
// Rust line comment.
/// Doc-comment — distinctly tinted.
fn greet(name: &str) -> String {
    let prefix = "Hello"; // inline
    format!("{}, {}!", prefix, name)
}
\`\`\`

## Backlinks & outline

Open the **side panel** (⌘.) to see this note's outline, the notes that link here, and where this note links *to*.

## Daily notes (⌘⇧D)

Press <kbd>⌘⇧D</kbd> anywhere to jump straight into today's daily note.  Trevor will create the \`Daily/\` folder if it doesn't exist yet.

## Vault switcher

The vault label in the title bar is now a dropdown.  Recently opened vaults live there for one-click switching.

## Settings — toggles, themes, fonts

Open <kbd>⌘,</kbd> to find the redesigned settings page.  Every toggle is now a proper switch with a smooth knob animation.  Themes preview live, accent picker accepts any HEX, and typography offers a real-time preview pane.

## Try it now

- [ ] Click a #showcase pill to filter notes
- [ ] Open the Tag Manager (toolbar tag icon)
- [ ] Promote #productivity to declared
- [ ] Toggle the side panel with ⌘.
- [ ] Hit ⌘⇧D for today's daily note
`,
  "/vault/Phase 3 Showcase.md": `# Phase 3 Showcase ✨

A walkthrough of everything new in Trevor.  Tags: #trevor/phase-3 #demo #showcase

## 🎨 Themes

Open **Settings → Appearance** (⌘,) and try every theme:

- Trevor Dark / Light · Midnight (OLED) · Solarized (Dark / Light)
- Dracula · Nord · Gruvbox · Monokai

You can also pick a custom **accent colour** from twelve presets or pick any HEX.

## ⌨️ Command Palette (⌘K)

Press <kbd>⌘K</kbd> to open the spotlight palette.  It searches **notes**, **tags**, and **commands** at once with fuzzy matching.

## 🌐 Graph View (⌘⇧G)

Visualise every [[wiki-link]] in your vault as a force-directed graph.  Click any node to jump to that note. Try it!

## 🔖 Tags

Type \`#anything\` and Trevor renders it as a clickable pill: #productivity, #ideas, #trevor/feature, #important.  Click a pill to filter the note list.

## 💻 Code Blocks with Language Switching

Every fenced code block is upgraded to a CodeMirror viewer with syntax highlighting & a language picker.

\`\`\`javascript
// Click the language label above to switch!
function fibonacci(n) {
  if (n < 2) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
console.log(fibonacci(10));
\`\`\`

\`\`\`python
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10))
\`\`\`

\`\`\`rust
fn fibonacci(n: u32) -> u32 {
    match n {
        0 | 1 => n,
        _ => fibonacci(n - 1) + fibonacci(n - 2),
    }
}

fn main() {
    println!("{}", fibonacci(10));
}
\`\`\`

\`\`\`sql
SELECT id, name, COUNT(*) AS notes_count
FROM users u
JOIN notes n ON n.user_id = u.id
GROUP BY u.id
ORDER BY notes_count DESC
LIMIT 10;
\`\`\`

## 📐 Math (KaTeX-ready)

Use \`$$ … $$\` for display math:

$$
e^{i\\pi} + 1 = 0
$$

## 🎯 Live Preview

Click the **eye** icon in the toolbar to switch between source and preview.  The preview now renders Mermaid diagrams **and** syntax-highlighted code blocks live.

\`\`\`mermaid
graph LR
    A[Phase 1\\nFoundation] --> B[Phase 2\\nUI + FS]
    B --> C[Phase 3\\nThemes + Graph + Palette]
    C --> D[Phase 4\\nSync + Mobile]
    style C fill:#7c5cff,stroke:#fff,color:#fff
\`\`\`

## ⚙️ Settings

Every preference persists to \`localStorage\`:

| Category | What you can change |
| --- | --- |
| Appearance | Theme, accent colour, quick mode |
| Typography | UI/Editor/Mono fonts, sizes, line height |
| Editor | Default mode, auto-save, smart typography |
| Code | Theme, font size, tab width, wrap, line numbers |
| Files | Default folder, attachments, new-note template |
| Privacy | Telemetry (always off — local-first promise) |

> [!INFO] Pro tip
> Use ⌘, to open Settings from anywhere in the app.

---

Related notes: [[Welcome to Trevor]] · [[Project Ideas]] · [[Canvas Mode]]
`,
  "/vault/Phase 5 Showcase.md": `---
tags:
  - showcase
  - trevor/phase-5
  - phase-5
---

# Phase 5 Showcase 🎨

Welcome to **Trevor Phase 5** — packed with features that take Trevor from a great markdown editor into a true thinking environment.

## 🖼️ Canvas / Whiteboard

Open the **Canvas** menu in the title bar (or press <kbd>⌘⇧C</kbd>) to launch an infinite whiteboard. Drop **text cards**, **note embeds**, **link cards** and **group boxes**, then connect them with auto-routed edges by dragging from a node's anchor handles.

> [!INFO] Try the demo canvas
> Open **Phase 5 Demo.canvas** from the sidebar — the file icon turns into a layout glyph and double-clicks straight into the whiteboard.

## 📜 Note version history

Every save is silently snapshotted into IndexedDB. Open the right panel (<kbd>⌘.</kbd>), expand the **History** section, and you'll see every version with timestamps and a +/− stat. Click 👁️ to preview any version, then ↻ to restore.

## ⚡ Snippet shortcuts

Type a trigger and press <kbd>Tab</kbd> to expand. Defaults include:

- \`:date\` → today's date
- \`:time\` → current time
- \`:meeting\` → meeting-notes scaffold
- \`:todo\` → empty checkbox
- \`:cb\` → code block
- \`:info\` → info callout

Manage them in **Settings → Snippets**. Use \`{{cursor}}\` in a body to control where the caret rests.

## ⏰ Pomodoro focus timer

Press <kbd>⌘P</kbd> (or click the clock icon in the title bar) to launch a floating focus timer. 25 min focus / 5 min break, persists across reloads.

## 🔍 Find in note

Press <kbd>⌘F</kbd> while editing a note for a tiny inline find bar with prev/next/case toggle. <kbd>Enter</kbd> for next, <kbd>⇧Enter</kbd> for previous.

## ⌨️ Keyboard shortcut help

Press <kbd>⌘/</kbd> to see every shortcut grouped by category — Mac glyphs auto-detected.

## ⭐ Pinned notes

Right-click any note in the sidebar and pick **Pin to top** to surface it in a dedicated **Pinned** section above the folder tree.

## 📤 Multi-format export

The new **Export** menu (download icon, top-right) offers:

| Format | What |
|--------|------|
| **PDF** | System print dialog with optimised stylesheet |
| **HTML** | Self-contained file with embedded dark theme |
| **Markdown** | Plain \`.md\` download of the active note |
| **Bundle** | Whole vault concatenated into a single \`.md\` archive |

## 🎯 Default-dark hardening

The very first paint is now guaranteed dark — even before React has booted. No more flash of light theme on slow connections.

---

Tags inline-only (no frontmatter promotion): #productivity #focus #writing
`,
  "/vault/Canvas/Phase 5 Demo.canvas": JSON.stringify({
    nodes: [
      { id: "g1",  type: "group", x: -300, y: -200, width: 660, height: 320, color: "6", label: "Phase 5 features" },
      { id: "n1",  type: "text",  x: -260, y: -130, width: 240, height: 110, color: "1", text: "**Canvas**\n\nInfinite whiteboard. Drag cards, connect with edges." },
      { id: "n2",  type: "text",  x:   60, y: -130, width: 240, height: 110, color: "5", text: "**History**\n\nIndexedDB-backed versions of every save." },
      { id: "n3",  type: "text",  x: -260, y:   40, width: 240, height: 110, color: "4", text: "**Snippets**\n\n\`:date + Tab\`, \`:meeting + Tab\`, etc." },
      { id: "n4",  type: "text",  x:   60, y:   40, width: 240, height: 110, color: "3", text: "**Pomodoro**\n\nFloating focus timer with chime." },
      { id: "n5",  type: "note",  x: -100, y:  180, width: 280, height: 130, color: "6", file: "/vault/Phase 5 Showcase.md" },
      { id: "n6",  type: "link",  x:  220, y:  180, width: 220, height: 70,  color: "5", url: "https://jsoncanvas.org/" },
    ],
    edges: [
      { id: "e1", fromNode: "n1", toNode: "n5", fromSide: "bottom", toSide: "top" },
      { id: "e2", fromNode: "n2", toNode: "n5", fromSide: "bottom", toSide: "top" },
      { id: "e3", fromNode: "n3", toNode: "n5", fromSide: "right",  toSide: "left" },
      { id: "e4", fromNode: "n4", toNode: "n5", fromSide: "left",   toSide: "right" },
      { id: "e5", fromNode: "n5", toNode: "n6", fromSide: "right",  toSide: "left", label: "spec" },
    ],
  }, null, 2),
  "/vault/Canvas Mode.md": `# Canvas Mode

## Concept

An infinite canvas where you can:

- Place text cards
- Draw freehand with [[Excalidraw]] integration
- Connect ideas visually
- Embed note excerpts

## JSON Canvas Spec

Following the open [\`jsoncanvas\`](https://jsoncanvas.org/) spec:

\`\`\`json
{
  "nodes": [
    { "id": "1", "type": "text", "x": 0, "y": 0, "width": 200, "height": 100, "text": "Idea A" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "1", "toNode": "2" }
  ]
}
\`\`\`

## Mermaid Flowchart

\`\`\`mermaid
flowchart LR
    A[Canvas Editor] --> B[React Flow]
    A --> C[Excalidraw]
    B --> D[JSON Canvas]
    C --> D
    D --> E[.canvas file]
\`\`\`

## Implementation Notes

- Save as \`.canvas\` files alongside \`.md\` files
- Use React Flow for the node graph
- Excalidraw for freehand drawing mode
`,
};

export class MockFS implements FileSystemAPI {
  private files: Map<string, MockFile> = new Map();

  constructor() {
    this.seed();
  }

  private seed(): void {
    const now = Date.now();
    const day = 86400000;

    // Create all directories (including nested ones)
    const dirs = [
      "/vault",
      "/vault/Recipes",
      "/vault/Recipes/Desserts",
      "/vault/Code Snippets",
      "/vault/Code Snippets/Web",
      "/vault/Canvas",
    ];
    for (let i = 0; i < dirs.length; i++) {
      this.files.set(dirs[i], {
        content: "",
        isDirectory: true,
        modifiedAt: now - (dirs.length - i) * day,
        createdAt: now - 60 * day,
      });
    }

    // Create files with staggered modification times
    const paths = Object.keys(SAMPLE_NOTES);
    for (let i = 0; i < paths.length; i++) {
      this.files.set(paths[i], {
        content: SAMPLE_NOTES[paths[i]],
        isDirectory: false,
        modifiedAt: now - i * day * 2 - Math.random() * day,
        createdAt: now - 60 * day,
      });
    }
  }

  // ── Ensure all parent directories exist ──
  private ensureParents(path: string): void {
    const parts = path.split("/").filter(Boolean);
    let current = "";
    // Don't create the last segment (that's the target itself)
    for (let i = 0; i < parts.length - 1; i++) {
      current += "/" + parts[i];
      if (!this.files.has(current)) {
        this.files.set(current, {
          content: "",
          isDirectory: true,
          modifiedAt: Date.now(),
          createdAt: Date.now(),
        });
      }
    }
  }

  async readDir(path: string): Promise<FileEntry[]> {
    const entries: FileEntry[] = [];
    const prefix = path.endsWith("/") ? path : path + "/";

    for (const [filePath, file] of this.files.entries()) {
      if (filePath === path) continue;
      if (!filePath.startsWith(prefix)) continue;

      // Only direct children (no nested paths after prefix)
      const remaining = filePath.slice(prefix.length);
      if (remaining.includes("/")) continue;

      entries.push({
        name: remaining,
        path: filePath,
        isDirectory: file.isDirectory,
        size: file.content.length,
        modifiedAt: file.modifiedAt,
        createdAt: file.createdAt,
      });
    }

    return entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async readDirRecursive(path: string): Promise<FileEntry[]> {
    const entries = await this.readDir(path);
    for (const entry of entries) {
      if (entry.isDirectory) {
        entry.children = await this.readDirRecursive(entry.path);
      }
    }
    return entries;
  }

  async createDir(path: string): Promise<void> {
    // Create all parent directories first
    this.ensureParents(path);
    if (!this.files.has(path)) {
      this.files.set(path, {
        content: "",
        isDirectory: true,
        modifiedAt: Date.now(),
        createdAt: Date.now(),
      });
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async readFile(path: string): Promise<string> {
    const file = this.files.get(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    if (file.isDirectory) {
      throw new Error(`Cannot read directory as file: ${path}`);
    }
    return file.content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    // Ensure parent directories exist
    this.ensureParents(path);

    const existing = this.files.get(path);
    this.files.set(path, {
      content,
      isDirectory: false,
      modifiedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    });
  }

  async remove(path: string): Promise<void> {
    // Remove this path and all children (for directories)
    const prefix = path + "/";
    const keysToDelete: string[] = [];
    for (const key of this.files.keys()) {
      if (key === path || key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.files.delete(key);
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const file = this.files.get(oldPath);
    if (!file) throw new Error(`File not found: ${oldPath}`);

    // Ensure parent of new path exists
    this.ensureParents(newPath);

    // Move this file/folder
    this.files.set(newPath, { ...file, modifiedAt: Date.now() });
    this.files.delete(oldPath);

    // If directory, move all children too
    if (file.isDirectory) {
      const prefix = oldPath + "/";
      const toMove: [string, MockFile][] = [];
      for (const [key, val] of this.files.entries()) {
        if (key.startsWith(prefix)) {
          toMove.push([key, val]);
        }
      }
      for (const [key, val] of toMove) {
        const newKey = newPath + key.slice(oldPath.length);
        this.files.set(newKey, val);
        this.files.delete(key);
      }
    }
  }

  async moveItem(sourcePath: string, targetDir: string): Promise<string> {
    const file = this.files.get(sourcePath);
    if (!file) throw new Error(`Source not found: ${sourcePath}`);

    const name = fileName(sourcePath);
    const newPath = joinPath(targetDir, name);

    // Check if target already exists
    if (this.files.has(newPath)) {
      throw new Error(`Target already exists: ${newPath}`);
    }

    // Ensure target directory exists
    await this.createDir(targetDir);

    // Use rename to perform the move
    await this.rename(sourcePath, newPath);

    return newPath;
  }

  async pickFolder(): Promise<string | null> {
    return "/vault";
  }
}
