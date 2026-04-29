/**
 * Trevor — Export helpers
 *
 * Single-file exporters that work in **both** runtimes:
 *
 *   • Browser  — falls back to a Blob + <a download> trick.
 *   • Tauri    — uses the native save dialog and writes via the FS plugin
 *                so users can choose any location their FS scope allows.
 *
 * Functions
 *   • exportNoteAsHtml(title, html)
 *   • exportNoteAsMarkdown(title, content)
 *   • exportVaultAsBundle(notes)
 *
 * The HTML output bundles a self-contained CSS theme so files render
 * beautifully offline with no asset dependencies.  External links keep
 * the Trevor "↗" affordance, and code blocks preserve their tinting.
 */

import { isTauri } from "../platform";

// ── Public API ────────────────────────────────────────────────────

export function exportNoteAsHtml(title: string, html: string): void {
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(title)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
<main class="markdown-preview">
<h1 class="title">${escape(title)}</h1>
${html}
</main>
</body>
</html>`;
  void saveTextFile(`${safeName(title)}.html`, doc, "text/html", [
    { name: "HTML page", extensions: ["html", "htm"] },
  ]);
}

export function exportNoteAsMarkdown(title: string, content: string): void {
  void saveTextFile(`${safeName(title)}.md`, content, "text/markdown", [
    { name: "Markdown", extensions: ["md", "markdown"] },
  ]);
}

export interface BundleEntry {
  path: string;
  content: string;
}

/**
 * Concatenates every note path + content into a single markdown bundle
 * separated by clear ASCII fences. Importable later by parsing those
 * fences back out (see importVaultBundle below).
 */
export function exportVaultAsBundle(notes: BundleEntry[]): void {
  const parts: string[] = [
    `# Trevor vault export — ${new Date().toISOString()}`,
    `Total notes: ${notes.length}`,
    "",
  ];
  for (const n of notes) {
    parts.push(
      "================================================================",
      `FILE: ${n.path}`,
      "================================================================",
      "",
      n.content,
      "",
    );
  }
  const filename = `trevor-vault-${new Date().toISOString().slice(0, 10)}.md`;
  void saveTextFile(filename, parts.join("\n"), "text/markdown", [
    { name: "Markdown bundle", extensions: ["md"] },
  ]);
}

/**
 * Parse a previously-exported vault bundle back into discrete notes.
 * Each block is split by the FILE: header.  Returns relative paths
 * (the original paths' basenames) so importer can place them under
 * a chosen target folder.
 */
export function parseVaultBundle(text: string): BundleEntry[] {
  const lines = text.split("\n");
  const out: BundleEntry[] = [];
  let i = 0;
  while (i < lines.length) {
    if (
      /^=+$/.test(lines[i] ?? "") &&
      /^FILE:\s+/.test(lines[i + 1] ?? "") &&
      /^=+$/.test(lines[i + 2] ?? "")
    ) {
      const fullPath = (lines[i + 1] ?? "").replace(/^FILE:\s+/, "").trim();
      const basename = fullPath.split("/").pop() ?? `note-${out.length + 1}.md`;
      i += 3;
      // skip the single blank line after the header if present
      if ((lines[i] ?? "").trim() === "") i += 1;
      const body: string[] = [];
      while (
        i < lines.length &&
        !(
          /^=+$/.test(lines[i] ?? "") &&
          /^FILE:\s+/.test(lines[i + 1] ?? "") &&
          /^=+$/.test(lines[i + 2] ?? "")
        )
      ) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      // Trim a single trailing blank line that the exporter inserts.
      while (body.length > 0 && body[body.length - 1] === "") body.pop();
      out.push({ path: basename, content: body.join("\n") });
    } else {
      i += 1;
    }
  }
  return out;
}

// ── Save helpers ──────────────────────────────────────────────────

interface SaveFilter {
  name: string;
  extensions: string[];
}

/**
 * Write text out via Tauri's native save dialog when available, else
 * trigger a browser download.  Both code paths return cleanly without
 * throwing if the user cancels.
 */
async function saveTextFile(
  defaultName: string,
  body: string,
  mime: string,
  filters: SaveFilter[],
): Promise<void> {
  if (isTauri()) {
    try {
      const dlg = await import("@tauri-apps/plugin-dialog");
      const fsApi = await import("@tauri-apps/plugin-fs");
      const path = await dlg.save({ defaultPath: defaultName, filters });
      if (!path) return; // user cancelled
      await fsApi.writeTextFile(path, body);
      return;
    } catch (e) {
      // Fall through to browser blob if the plugins refused (e.g. dev shell).
      console.warn("Tauri save failed, falling back to browser download:", e);
    }
  }
  triggerBrowserDownload(defaultName, body, mime);
}

function triggerBrowserDownload(filename: string, body: string, mime: string): void {
  const blob = new Blob([body], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function escape(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] ?? c));
}

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "note";
}

// ── Self-contained HTML CSS (matches Trevor's preview aesthetic) ──

const BASE_CSS = `
:root { --bg:#0d0d0f; --surface:#1c1c20; --text:#e6e6e9; --muted:#a8a8b1; --border:#2e2e36; --accent:#7c5cff; --accent-rgb:124,92,255; }
@media (prefers-color-scheme: light) {
  :root { --bg:#fafafa; --surface:#ffffff; --text:#18181b; --muted:#4b4b54; --border:#d4d6db; --accent:#6d28d9; --accent-rgb:109,40,217; }
}
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text);
  font-family: "Inter", -apple-system, system-ui, sans-serif;
  font-size:16px; line-height:1.7; }
main { max-width: 760px; margin: 0 auto; padding: 56px 24px; }
.title { font-size:34px; font-weight:700; line-height:1.2; margin: 0 0 24px; border-bottom: 1px solid var(--border); padding-bottom:12px; }
h1, h2, h3, h4, h5, h6 { color: var(--text); }
h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: .3em; }
h3 { font-size: 1.25em; }
p { margin: .8em 0; }
a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(var(--accent-rgb), 0.3); }
a:hover { border-bottom-color: var(--accent); }
a.external-link { white-space: nowrap; }
a.external-link .external-link-icon { display:inline-block; vertical-align:baseline; margin-left:2px; transform: translateY(1px); opacity:.85; }
ul, ol { padding-left: 1.6em; }
li { margin: .3em 0; }
blockquote { margin: 1em 0; padding: .4em 1em; border-left: 3px solid var(--accent);
  background: rgba(var(--accent-rgb),0.08); color: var(--muted); border-radius: 0 4px 4px 0; }
code { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: .88em;
  padding: .15em .4em; background: var(--surface); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text); }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
  padding: 1em 1.2em; overflow-x: auto; }
pre code { background: none; border: 0; padding: 0; display: block; line-height: 1.55; }
hr { border: 0; border-top: 1px solid var(--border); margin: 2em 0; }
img { max-width: 100%; border-radius: 6px; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid var(--border); padding: .5em .8em; text-align: left; }
th { background: var(--surface); font-weight: 600; }
.tag-pill { display:inline-flex; align-items:center; padding:.05em .55em; font-size:.82em;
  border-radius:999px; border:1px solid var(--border); margin: 0 2px; text-decoration: none; }
.tag-pill-declared { background: rgba(var(--accent-rgb),0.15); color: var(--accent); border-color: rgba(var(--accent-rgb),0.35); }
.declared-tag-bar { display:flex; flex-wrap:wrap; gap:.35em; margin: 0 0 1.2em; padding-bottom: .6em;
  border-bottom: 1px dashed var(--border); }
.callout { margin: 1em 0; padding: .8em 1em; border-left: 3px solid var(--accent);
  background: rgba(var(--accent-rgb),0.08); border-radius: 0 6px 6px 0; }
.wiki-link { color: var(--accent); background: rgba(var(--accent-rgb),0.12); padding: .05em .4em;
  border-radius: 4px; border-bottom: 0; font-weight: 500; }
mark { background: rgba(var(--accent-rgb),0.25); color: inherit; padding: 0 .15em; border-radius: 2px; }
`;
