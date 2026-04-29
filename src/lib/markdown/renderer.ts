/**
 * Trevor — Markdown Renderer
 *
 * Converts markdown to HTML with support for:
 * - YAML frontmatter (extracted, declared tags rendered as a tag bar)
 * - Headings, bold, italic, strikethrough, highlight, underline (HTML)
 * - Code blocks with language hints (handed off to CodeMirror)
 * - Mermaid diagrams
 * - Tables, task lists, blockquotes, lists
 * - Wiki-links [[...]] and inline #hashtags
 * - Images and external links
 *
 * Inline #hashtags use a "soft" pill style; declared frontmatter tags
 * use a stronger "declared" style so the two are visually distinct.
 */

import { parseFrontmatter, extractDeclaredTags } from "@/lib/tags";

export function renderMarkdown(md: string): string {
  // 1) Strip frontmatter and emit a tag bar if any tags were declared.
  const fm = parseFrontmatter(md);
  const declared = extractDeclaredTags(md);
  const declaredSet = new Set(declared);

  const html: string[] = [];

  if (declared.length > 0) {
    const pills = declared
      .map(
        (t) =>
          `<a class="tag-pill tag-pill-declared" data-tag="${escapeAttr(t)}" data-kind="declared" href="#tag/${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`,
      )
      .join("");
    html.push(`<div class="declared-tag-bar" aria-label="Declared tags">${pills}</div>`);
  }

  // 2) Render the body.
  const lines = fm.body.split("\n");
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeContent: string[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let inBlockquote = false;
  let blockquoteLines: string[] = [];
  let blockquoteCalloutKind: string | null = null;
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let listItems: string[] = [];

  function flushBlockquote() {
    if (inBlockquote && blockquoteLines.length > 0) {
      if (blockquoteCalloutKind) {
        const kind = blockquoteCalloutKind.toLowerCase();
        const inner = blockquoteLines
          .map((l) => `<p>${inlineFormat(l, declaredSet)}</p>`)
          .join("");
        html.push(`<div class="callout callout-${kind}">${inner}</div>`);
      } else {
        html.push(
          `<blockquote>${blockquoteLines.map((l) => `<p>${inlineFormat(l, declaredSet)}</p>`).join("")}</blockquote>`,
        );
      }
      blockquoteLines = [];
      blockquoteCalloutKind = null;
      inBlockquote = false;
    }
  }

  function flushList() {
    if (inList && listItems.length > 0) {
      const tag = listType;
      html.push(
        `<${tag}>${listItems.map((item) => `<li>${inlineFormat(item, declaredSet)}</li>`).join("")}</${tag}>`,
      );
      listItems = [];
      inList = false;
    }
  }

  function flushTable() {
    if (inTable && tableRows.length > 0) {
      const headerRow = tableRows[0];
      const bodyRows = tableRows.slice(1);
      const headerCells = headerRow.split("|").filter((c) => c.trim());
      let tableHtml = '<div class="table-wrapper"><table><thead><tr>';
      for (const cell of headerCells) {
        tableHtml += `<th>${inlineFormat(cell.trim(), declaredSet)}</th>`;
      }
      tableHtml += "</tr></thead><tbody>";
      for (const row of bodyRows) {
        const cells = row.split("|").filter((c) => c.trim());
        tableHtml += "<tr>";
        for (const cell of cells) {
          tableHtml += `<td>${inlineFormat(cell.trim(), declaredSet)}</td>`;
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</tbody></table></div>";
      html.push(tableHtml);
      tableRows = [];
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ── Code blocks ──
    if (line.trimStart().startsWith("```")) {
      if (!inCodeBlock) {
        flushBlockquote();
        flushList();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = line.trimStart().slice(3).trim();
        codeContent = [];
        continue;
      } else {
        inCodeBlock = false;
        const content = escapeHtml(codeContent.join("\n"));
        if (codeBlockLang === "mermaid") {
          html.push(
            `<div class="mermaid-block" data-mermaid="${encodeURIComponent(codeContent.join("\n"))}"><pre class="mermaid-source"><code>${content}</code></pre></div>`,
          );
        } else {
          html.push(
            `<pre><code class="language-${codeBlockLang || "text"}">${content}</code></pre>`,
          );
        }
        codeBlockLang = "";
        codeContent = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeContent.push(line);
      continue;
    }

    // ── Horizontal rule ──
    if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
      flushBlockquote();
      flushList();
      flushTable();
      html.push("<hr />");
      continue;
    }

    // ── Headings ──
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushBlockquote();
      flushList();
      flushTable();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      html.push(
        `<h${level} id="${id}">${inlineFormat(text, declaredSet)}</h${level}>`,
      );
      continue;
    }

    // ── Table ──
    if (line.includes("|") && line.trim().startsWith("|")) {
      flushBlockquote();
      flushList();
      // Skip separator row
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push(line.trim());
      continue;
    } else if (inTable) {
      flushTable();
    }

    // ── Blockquote / Callout ──
    if (line.startsWith(">")) {
      flushList();
      flushTable();
      const stripped = line.replace(/^>\s?/, "");
      // Detect Obsidian-style callouts: `[!INFO] title`
      const callout = stripped.match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout && !inBlockquote) {
        inBlockquote = true;
        blockquoteCalloutKind = callout[1];
        if (callout[2]) blockquoteLines.push(callout[2]);
        continue;
      }
      inBlockquote = true;
      blockquoteLines.push(stripped);
      continue;
    } else if (inBlockquote) {
      flushBlockquote();
    }

    // ── Task list ──
    const taskMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      flushBlockquote();
      flushTable();
      if (!inList || listType !== "ul") {
        flushList();
        inList = true;
        listType = "ul";
      }
      const checked = taskMatch[2] !== " ";
      const text = taskMatch[3];
      listItems.push(
        `<label class="task-item"><input type="checkbox" ${checked ? "checked" : ""} disabled /><span>${inlineFormat(text, declaredSet)}</span></label>`,
      );
      continue;
    }

    // ── Unordered list ──
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (ulMatch) {
      flushBlockquote();
      flushTable();
      if (!inList || listType !== "ul") {
        flushList();
        inList = true;
        listType = "ul";
      }
      listItems.push(ulMatch[2]);
      continue;
    }

    // ── Ordered list ──
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      flushBlockquote();
      flushTable();
      if (!inList || listType !== "ol") {
        flushList();
        inList = true;
        listType = "ol";
      }
      listItems.push(olMatch[2]);
      continue;
    }

    if (inList) {
      flushList();
    }

    // ── Empty line ──
    if (line.trim() === "") {
      flushBlockquote();
      flushList();
      flushTable();
      continue;
    }

    // ── Paragraph ──
    html.push(`<p>${inlineFormat(line, declaredSet)}</p>`);
  }

  // Flush remaining
  if (inCodeBlock) {
    const content = escapeHtml(codeContent.join("\n"));
    html.push(`<pre><code>${content}</code></pre>`);
  }
  flushBlockquote();
  flushList();
  flushTable();

  return html.join("\n");
}

// ── Inline formatting ──

function inlineFormat(text: string, declaredSet: Set<string>): string {
  let result = text;

  // Inline code (must be first to prevent inner formatting)
  result = result.replace(
    /`([^`]+)`/g,
    '<code class="inline-code">$1</code>',
  );

  // Images ![alt](url)
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" />',
  );

  // Links [text](url) — external links get a small ↗ trailing icon and
  // an `external-link` class so CSS can style them distinctively.
  // SVG is inlined so it survives HTML / PDF export with no asset deps.
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_full, text: string, url: string) => {
      const isExternal = /^(https?:|mailto:|ftp:|tel:)/i.test(url.trim());
      const safeUrl = url.trim().replace(/"/g, "&quot;");
      if (!isExternal) {
        return `<a href="${safeUrl}" target="_blank" rel="noopener">${text}</a>`;
      }
      const arrow =
        '<svg class="external-link-icon" width="10" height="10" viewBox="0 0 24 24" ' +
        'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" ' +
        'stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M7 17L17 7"></path><path d="M8 7h9v9"></path></svg>';
      return `<a class="external-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}${arrow}</a>`;
    },
  );

  // Wiki-links [[note name]]
  result = result.replace(
    /\[\[([^\]]+)\]\]/g,
    '<span class="wiki-link" data-link="$1">$1</span>',
  );

  // Inline #hashtags — preceded by start/whitespace, followed by word boundary.
  // Tag is rendered with a "kind" attribute distinguishing declared vs inline.
  result = result.replace(
    /(^|\s)#([A-Za-z][\w/-]*)/g,
    (_full, lead: string, tag: string) => {
      const isDeclared = declaredSet.has(tag);
      const cls = isDeclared ? "tag-pill tag-pill-declared" : "tag-pill tag-pill-inline";
      const kind = isDeclared ? "declared" : "inline";
      return `${lead}<a class="${cls}" data-tag="${escapeAttr(tag)}" data-kind="${kind}" href="#tag/${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`;
    },
  );

  // Bold + Italic
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  result = result.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");
  result = result.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  result = result.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Highlight ==text==
  result = result.replace(/==(.+?)==/g, "<mark>$1</mark>");

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Extract all [[wiki-links]] from markdown content */
export function extractWikiLinks(content: string): string[] {
  const matches = content.match(/\[\[([^\]]+)\]\]/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(2, -2));
}

/** Extract all #tags (excluding code blocks) from markdown content */
export function extractTags(content: string): string[] {
  const noCode = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
  const matches = noCode.match(/(^|\s)#([A-Za-z][\w/-]*)/g);
  if (!matches) return [];
  const tags = matches.map((m) => m.trim().slice(1));
  return Array.from(new Set(tags));
}

/** Extract first heading or fallback line as title preview */
export function extractTitle(content: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}
