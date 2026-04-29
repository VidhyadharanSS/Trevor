/**
 * Trevor — Outline / TOC builder
 *
 * Walks markdown headings to produce a flat list of `{level, text, slug}`.
 * Code-fenced lines are excluded so `# foo` inside `\`\`\`` doesn't count.
 */

export interface OutlineHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  slug: string;
  /** Line index within the source (0-based) — useful for "jump to". */
  line: number;
}

export function buildOutline(content: string): OutlineHeading[] {
  // Strip frontmatter for accurate line numbers offset later (we still keep
  // the line index in the raw source so jump-to works).
  const lines = content.split("\n");
  const headings: OutlineHeading[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) { inCode = !inCode; continue; }
    if (inCode) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const level = m[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    const text = m[2].replace(/[*_`~]/g, "").trim();
    const slug = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
    headings.push({ level, text, slug, line: i });
  }

  return headings;
}
