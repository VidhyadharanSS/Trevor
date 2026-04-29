/**
 * Trevor — Markdown Preview Component
 *
 * Renders markdown content as styled HTML, then mounts:
 *   • <MermaidBlock>   for `mermaid` fenced code
 *   • <CodeBlock>      for every other fenced code block (CodeMirror)
 *
 * Also wires wiki-link, tag, and external-link click handlers.
 */
import {
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { renderMarkdown } from "@/lib/markdown/renderer";
import { MermaidBlock } from "./MermaidBlock";
import { CodeBlock } from "./CodeBlock";
import { createRoot, type Root } from "react-dom/client";

interface MarkdownPreviewProps {
  content: string;
  onWikiLinkClick?: (linkName: string) => void;
  onTagClick?: (tag: string) => void;
}

export function MarkdownPreview({
  content,
  onWikiLinkClick,
  onTagClick,
}: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactRootsRef = useRef<Root[]>([]);

  const html = useMemo(() => renderMarkdown(content), [content]);

  // Mount Mermaid + CodeBlock components after HTML is rendered.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Cleanup previous React roots from prior render.
    for (const root of reactRootsRef.current) {
      try {
        root.unmount();
      } catch {
        /* root already unmounted */
      }
    }
    reactRootsRef.current = [];

    // 1.  Mermaid blocks
    const mermaidBlocks = container.querySelectorAll(".mermaid-block");
    mermaidBlocks.forEach((block) => {
      const code = decodeURIComponent(block.getAttribute("data-mermaid") ?? "");
      if (!code) return;
      const mountPoint = document.createElement("div");
      block.innerHTML = "";
      block.appendChild(mountPoint);
      const root = createRoot(mountPoint);
      root.render(<MermaidBlock code={code} />);
      reactRootsRef.current.push(root);
    });

    // 2.  Regular fenced code blocks → upgrade to CodeMirror viewer.
    const codeNodes = container.querySelectorAll("pre > code[class*='language-']");
    codeNodes.forEach((codeEl) => {
      const pre = codeEl.parentElement;
      if (!pre) return;
      const langClass = Array.from(codeEl.classList).find((c) =>
        c.startsWith("language-"),
      );
      const lang = langClass ? langClass.replace("language-", "") : "text";
      // Skip mermaid (already handled) and inline-coded language stub `text` if empty.
      if (lang === "mermaid") return;
      const raw = decodeHtml(codeEl.innerHTML);
      const wrapper = document.createElement("div");
      pre.replaceWith(wrapper);
      const root = createRoot(wrapper);
      root.render(<CodeBlock code={raw} language={lang} />);
      reactRootsRef.current.push(root);
    });

    return () => {
      for (const root of reactRootsRef.current) {
        try {
          root.unmount();
        } catch {
          /* ignore */
        }
      }
      reactRootsRef.current = [];
    };
  }, [html]);

  // Click delegation: wiki-links, tag pills.
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;

      const wikiLink = target.closest(".wiki-link");
      if (wikiLink && onWikiLinkClick) {
        e.preventDefault();
        const linkName = wikiLink.getAttribute("data-link");
        if (linkName) onWikiLinkClick(linkName);
        return;
      }

      const tagEl = target.closest(".tag-pill");
      if (tagEl) {
        e.preventDefault();
        const tag = tagEl.getAttribute("data-tag");
        if (tag && onTagClick) onTagClick(tag);
        return;
      }
    },
    [onWikiLinkClick, onTagClick],
  );

  return (
    <div
      ref={containerRef}
      className="markdown-preview"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Decode HTML entities introduced by the markdown renderer's escape pass. */
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
