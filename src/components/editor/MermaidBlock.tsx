/**
 * Trevor — Mermaid Diagram Renderer
 *
 * Renders mermaid code blocks as SVG diagrams.
 * Shows source code while editing, renders diagram when not focused.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";

// Initialize mermaid with Trevor's dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  darkMode: true,
  themeVariables: {
    primaryColor: "#6366f1",
    primaryTextColor: "#e4e4e7",
    primaryBorderColor: "#4338ca",
    lineColor: "#71717a",
    secondaryColor: "#232326",
    tertiaryColor: "#1c1c1e",
    background: "#0f0f0f",
    mainBkg: "#232326",
    nodeBorder: "#6366f1",
    clusterBkg: "#1c1c1e",
    titleColor: "#e4e4e7",
    actorBkg: "#232326",
    actorBorder: "#6366f1",
    actorTextColor: "#e4e4e7",
    actorLineColor: "#71717a",
    signalColor: "#e4e4e7",
    signalTextColor: "#e4e4e7",
    noteBkgColor: "#232326",
    noteTextColor: "#e4e4e7",
    noteBorderColor: "#6366f1",
  },
  fontFamily:
    'SF Mono, JetBrains Mono, Fira Code, Cascadia Code, monospace',
  fontSize: 14,
});

let mermaidId = 0;

interface MermaidBlockProps {
  code: string;
}

export function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showSource, setShowSource] = useState(false);

  const renderDiagram = useCallback(async () => {
    if (!code.trim()) return;

    try {
      const id = `mermaid-${++mermaidId}`;
      const { svg: renderedSvg } = await mermaid.render(id, code.trim());
      setSvg(renderedSvg);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render diagram");
      setSvg("");
    }
  }, [code]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  const toggleView = useCallback(() => {
    setShowSource((prev) => !prev);
  }, []);

  return (
    <div className="mermaid-container my-4 rounded-lg border border-trevor-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-trevor-bg-secondary border-b border-trevor-border">
        <span className="text-[11px] font-medium text-trevor-text-muted uppercase tracking-wider">
          Mermaid Diagram
        </span>
        <button
          onClick={toggleView}
          className="text-[11px] text-trevor-accent hover:text-trevor-accent-hover transition-colors px-2 py-0.5 rounded"
        >
          {showSource ? "Show Diagram" : "Show Source"}
        </button>
      </div>

      {/* Content */}
      {showSource ? (
        <pre className="p-4 bg-trevor-bg-tertiary overflow-x-auto">
          <code className="text-[13px] text-trevor-text font-mono">{code}</code>
        </pre>
      ) : error ? (
        <div className="p-4 bg-trevor-bg-tertiary">
          <p className="text-[13px] text-trevor-danger mb-2">
            Diagram rendering error:
          </p>
          <pre className="text-[12px] text-trevor-text-muted font-mono whitespace-pre-wrap">
            {error}
          </pre>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="p-4 bg-trevor-bg-tertiary flex justify-center overflow-x-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
}
