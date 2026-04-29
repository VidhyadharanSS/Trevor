/**
 * Trevor — Tag System
 *
 * Two distinct tag concepts coexist in Trevor:
 *
 *   1. **Declared tags** — a first-class list defined in the note's YAML
 *      frontmatter under `tags:`.  These are user-curated and survive
 *      regardless of inline writing style.  The Tag Manager (UI) reads
 *      and writes only this list.
 *
 *   2. **Inline hashtags** — `#word` written anywhere in prose.  These
 *      are still *recognised* (rendered as pills, indexed for search)
 *      but treated as *suggestions* — the Tag Manager does not delete
 *      them, and they are visually distinguished from declared tags.
 *
 * This file owns all parse / serialise / mutate logic for both kinds.
 */

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export interface ParsedTags {
  /** Tags declared in the YAML frontmatter (curated, ordered). */
  declared: string[];
  /** Inline `#hashtag` occurrences in the body (deduped, in order). */
  inline: string[];
}

export interface NoteFrontmatter {
  /** Raw frontmatter object (string keys, mixed values). */
  data: Record<string, unknown>;
  /** Body content without the frontmatter block. */
  body: string;
  /** True if a frontmatter block was present in the input. */
  hadFrontmatter: boolean;
}

/* ── Frontmatter parsing (no external deps) ─────────────────────────── */

/**
 * Parse a markdown document into frontmatter + body.  Supports a tiny
 * subset of YAML that is enough for our needs:
 *   • `key: value`
 *   • `key: [a, b, c]`
 *   • Indented list:
 *         tags:
 *           - foo
 *           - bar
 */
export function parseFrontmatter(content: string): NoteFrontmatter {
  const m = content.match(FRONTMATTER_RE);
  if (!m) return { data: {}, body: content, hadFrontmatter: false };

  const yaml = m[1];
  const data: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    let val: unknown = kv[2].trim();

    // Inline list: [a, b, c]
    if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (val === "") {
      // Indented list under this key.
      const listItems: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
        listItems.push(lines[j].replace(/^\s+-\s+/, "").trim().replace(/^["']|["']$/g, ""));
        j++;
      }
      if (listItems.length > 0) {
        val = listItems;
        i = j - 1;
      }
    } else if (typeof val === "string") {
      // Strip surrounding quotes.
      val = val.replace(/^["']|["']$/g, "");
    }

    data[key] = val;
    i++;
  }

  return {
    data,
    body: content.slice(m[0].length),
    hadFrontmatter: true,
  };
}

/** Re-serialise a NoteFrontmatter object back into a markdown document. */
export function stringifyFrontmatter(fm: NoteFrontmatter): string {
  const keys = Object.keys(fm.data);
  if (keys.length === 0) return fm.body;
  const lines: string[] = ["---"];
  for (const k of keys) {
    const v = fm.data[k];
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) lines.push(`  - ${quoteIfNeeded(String(item))}`);
      }
    } else if (v == null) {
      lines.push(`${k}:`);
    } else {
      lines.push(`${k}: ${quoteIfNeeded(String(v))}`);
    }
  }
  lines.push("---", "");
  // Ensure body starts with no leading whitespace mismatch.
  return lines.join("\n") + (fm.body.startsWith("\n") ? fm.body.slice(1) : fm.body);
}

function quoteIfNeeded(s: string): string {
  if (/[:#\[\]{}|&*!,?]/.test(s) || /^\s|\s$/.test(s)) return JSON.stringify(s);
  return s;
}

/* ── Tag extraction ─────────────────────────────────────────────────── */

/** Extract declared tags from frontmatter. */
export function extractDeclaredTags(content: string): string[] {
  const fm = parseFrontmatter(content);
  const raw = fm.data.tags;
  if (Array.isArray(raw)) {
    return raw.map((t) => String(t).trim().replace(/^#/, "")).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[,\s]+/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
  }
  return [];
}

/** Extract inline `#hashtag` occurrences from the body, excluding code blocks. */
export function extractInlineTags(content: string): string[] {
  const fm = parseFrontmatter(content);
  const noCode = fm.body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "");
  const matches = noCode.match(/(^|[^\w])#([A-Za-z][\w/-]*)/g);
  if (!matches) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const tag = m.replace(/^[^#]*#/, "");
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/** Extract all tags (declared + inline, deduped). */
export function extractAllTags(content: string): ParsedTags {
  return {
    declared: extractDeclaredTags(content),
    inline: extractInlineTags(content),
  };
}

/* ── Tag mutation ───────────────────────────────────────────────────── */

/** Add a declared tag to the note frontmatter (idempotent). */
export function addDeclaredTag(content: string, tag: string): string {
  const cleaned = tag.trim().replace(/^#/, "");
  if (!cleaned) return content;
  const fm = parseFrontmatter(content);
  const existing = Array.isArray(fm.data.tags)
    ? (fm.data.tags as unknown[]).map((t) => String(t))
    : typeof fm.data.tags === "string" && fm.data.tags
      ? [String(fm.data.tags)]
      : [];
  if (existing.includes(cleaned)) return content; // idempotent
  fm.data.tags = [...existing, cleaned];
  return stringifyFrontmatter(fm);
}

/** Remove a declared tag from the note frontmatter (idempotent). */
export function removeDeclaredTag(content: string, tag: string): string {
  const cleaned = tag.trim().replace(/^#/, "");
  const fm = parseFrontmatter(content);
  const existing = Array.isArray(fm.data.tags)
    ? (fm.data.tags as unknown[]).map((t) => String(t))
    : typeof fm.data.tags === "string" && fm.data.tags
      ? [String(fm.data.tags)]
      : [];
  const next = existing.filter((t) => t !== cleaned);
  if (next.length === existing.length) return content;
  if (next.length === 0) {
    delete fm.data.tags;
  } else {
    fm.data.tags = next;
  }
  // If removing tags leaves an empty frontmatter, drop the block.
  if (Object.keys(fm.data).length === 0 && fm.hadFrontmatter) {
    return fm.body;
  }
  return stringifyFrontmatter(fm);
}

/** Rename a declared tag everywhere in the note (frontmatter + inline). */
export function renameDeclaredTag(content: string, from: string, to: string): string {
  const a = from.replace(/^#/, "");
  const b = to.replace(/^#/, "");
  if (!a || !b || a === b) return content;
  let next = removeDeclaredTag(content, a);
  next = addDeclaredTag(next, b);
  // Also rewrite inline #a -> #b (word-boundary safe).
  next = next.replace(
    new RegExp(`(^|[^\\w])#${escapeRe(a)}(?![\\w/-])`, "g"),
    `$1#${b}`,
  );
  return next;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ── Vault-wide aggregation ─────────────────────────────────────────── */

export interface TagStat {
  tag: string;
  /** Number of notes that declare this tag. */
  declaredCount: number;
  /** Number of notes that use this tag inline. */
  inlineCount: number;
  /** All paths that contain the tag (declared OR inline). */
  paths: string[];
}

/** Build a vault-wide tag index from the in-memory content cache. */
export function buildTagIndex(cache: Map<string, string>): TagStat[] {
  const stats = new Map<string, TagStat>();
  for (const [path, content] of cache) {
    const { declared, inline } = extractAllTags(content);
    for (const tag of declared) {
      const s = stats.get(tag) ?? { tag, declaredCount: 0, inlineCount: 0, paths: [] };
      s.declaredCount++;
      if (!s.paths.includes(path)) s.paths.push(path);
      stats.set(tag, s);
    }
    for (const tag of inline) {
      const s = stats.get(tag) ?? { tag, declaredCount: 0, inlineCount: 0, paths: [] };
      s.inlineCount++;
      if (!s.paths.includes(path)) s.paths.push(path);
      stats.set(tag, s);
    }
  }
  return Array.from(stats.values()).sort((a, b) =>
    (b.declaredCount + b.inlineCount) - (a.declaredCount + a.inlineCount) || a.tag.localeCompare(b.tag),
  );
}

/** Does a note contain the tag (declared or inline)? */
export function noteHasTag(content: string, tag: string): boolean {
  const cleaned = tag.replace(/^#/, "");
  const { declared, inline } = extractAllTags(content);
  return declared.includes(cleaned) || inline.includes(cleaned);
}
