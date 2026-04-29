/**
 * Trevor — Canvas View (JSON Canvas)
 *
 * An infinite, pan-and-zoom whiteboard that reads/writes JSON Canvas
 * v1.0 files (.canvas).  Supports four node kinds:
 *
 *   • text  — free-form sticky note (markdown supported on render)
 *   • note  — embed a vault .md file (read-only preview)
 *   • link  — external URL pill
 *   • group — a labelled bounding box behind other nodes
 *
 * Edges connect any two nodes with auto-routed orthogonal lines.
 *
 * The component is self-contained: it owns its own viewport state
 * (translate + scale), selection state, drag/connect interactions,
 * and a tiny inline node-editor for text nodes.  All persistence
 * happens through `onChange(canvas)`.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Plus, FileText, Link2, Square, Trash2, MousePointer,
  Type as TypeIcon, ZoomIn, ZoomOut, Maximize2, X, Save,
  Palette, ArrowRight,
} from "lucide-react";
import {
  CanvasFile, CanvasNode, CanvasEdge, EdgeSide,
  newId, resolveColor, CANVAS_COLORS, parseCanvas, stringifyCanvas,
  TextCanvasNode, NoteCanvasNode, LinkCanvasNode, GroupCanvasNode,
} from "@/lib/canvas/types";

interface CanvasViewProps {
  /** Stable key — switches re-init the view when a different canvas opens. */
  fileKey: string;
  /** Initial JSON-Canvas content (text). */
  initialContent: string;
  /** Vault note paths/titles for the "embed note" picker. */
  vaultNotes: Array<{ path: string; title: string }>;
  /** Persist a new canvas state. */
  onSave: (json: string) => void;
  /** Click an embedded note to open it. */
  onOpenNote: (path: string) => void;
  /** Close the canvas. */
  onClose: () => void;
}

type Tool = "select" | "text" | "note" | "link" | "group" | "connect";
type Connecting = { from: string; fromSide: EdgeSide } | null;

export function CanvasView({
  fileKey, initialContent, vaultNotes, onSave, onOpenNote, onClose,
}: CanvasViewProps) {
  // Parsed canvas state (with deep-copy so we never mutate the prop).
  const [canvas, setCanvas] = useState<CanvasFile>(() => parseCanvas(initialContent));
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Viewport (camera).
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  // Pan / drag state.
  const dragRef = useRef<
    | { kind: "pan"; startX: number; startY: number; viewX: number; viewY: number }
    | { kind: "node"; id: string; offsetX: number; offsetY: number }
    | { kind: "resize"; id: string; corner: "br" }
    | null
  >(null);
  const [connecting, setConnecting] = useState<Connecting>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileKeyRef = useRef(fileKey);

  // Re-parse when the file changes.
  useEffect(() => {
    if (fileKeyRef.current !== fileKey) {
      fileKeyRef.current = fileKey;
      setCanvas(parseCanvas(initialContent));
      setDirty(false);
      setSelectedId(null);
      setEditingId(null);
      setView({ x: 0, y: 0, scale: 1 });
    }
  }, [fileKey, initialContent]);

  /** Push a new canvas state and mark dirty. */
  const update = useCallback((next: CanvasFile) => {
    setCanvas(next);
    setDirty(true);
  }, []);

  /** Save now. */
  const handleSave = useCallback(() => {
    onSave(stringifyCanvas(canvas));
    setDirty(false);
  }, [canvas, onSave]);

  // Auto-save (debounced) whenever canvas changes.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      onSave(stringifyCanvas(canvas));
      setDirty(false);
    }, 800);
    return () => clearTimeout(t);
  }, [canvas, dirty, onSave]);

  // ── Coordinate helpers ────────────────────────────────────────────
  /** Convert a screen point (clientX/Y) → canvas-space coordinates. */
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - view.x) / view.scale,
        y: (clientY - rect.top - view.y) / view.scale,
      };
    },
    [view],
  );

  // ── Tool handlers ────────────────────────────────────────────────
  const handleAddNode = useCallback(
    (kind: Exclude<Tool, "select" | "connect">, atScreen?: { x: number; y: number }) => {
      const center = atScreen
        ? screenToCanvas(atScreen.x, atScreen.y)
        : screenToCanvas(
            (containerRef.current?.clientWidth ?? 600) / 2,
            (containerRef.current?.clientHeight ?? 400) / 2,
          );
      const base = {
        id: newId(kind),
        x: Math.round(center.x - 100),
        y: Math.round(center.y - 50),
        width: 220,
        height: 120,
      };
      let node: CanvasNode;
      if (kind === "text") {
        node = { ...base, type: "text", text: "New idea" } as TextCanvasNode;
      } else if (kind === "note") {
        node = { ...base, type: "note", file: vaultNotes[0]?.path ?? "" } as NoteCanvasNode;
      } else if (kind === "link") {
        node = { ...base, type: "link", url: "https://example.com" } as LinkCanvasNode;
      } else {
        node = { ...base, width: 360, height: 240, type: "group", label: "Group" } as GroupCanvasNode;
      }
      update({
        ...canvas,
        nodes: [...canvas.nodes, node],
      });
      setTool("select");
      setSelectedId(node.id);
      if (kind === "text") setEditingId(node.id);
    },
    [canvas, screenToCanvas, update, vaultNotes],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    update({
      nodes: canvas.nodes.filter((n) => n.id !== selectedId),
      edges: canvas.edges.filter((e) => e.fromNode !== selectedId && e.toNode !== selectedId),
    });
    setSelectedId(null);
    setEditingId(null);
  }, [selectedId, canvas, update]);

  const handleSetColor = useCallback(
    (color: string | null) => {
      if (!selectedId) return;
      update({
        ...canvas,
        nodes: canvas.nodes.map((n) =>
          n.id === selectedId ? { ...n, color: color ?? undefined } : n,
        ),
      });
    },
    [selectedId, canvas, update],
  );

  const handleNodePatch = useCallback(
    <K extends keyof CanvasNode>(id: string, patch: Partial<CanvasNode>) => {
      update({
        ...canvas,
        nodes: canvas.nodes.map((n) =>
          n.id === id ? ({ ...n, ...patch } as CanvasNode) : n,
        ),
      });
      // Silence unused generic.
      void ({} as K);
    },
    [canvas, update],
  );

  // ── Pointer interactions ──────────────────────────────────────────
  const onContainerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Right-click / middle-click → pan, regardless of tool.
      const isPanGesture = e.button === 1 || e.button === 2 || (tool === "select" && (e.target as HTMLElement).dataset.canvasBg === "true");
      if (e.button === 0 && tool !== "select" && tool !== "connect") {
        // Click-to-create on background.
        if ((e.target as HTMLElement).dataset.canvasBg === "true") {
          handleAddNode(tool, { x: e.clientX, y: e.clientY });
          return;
        }
      }
      if (isPanGesture) {
        dragRef.current = {
          kind: "pan",
          startX: e.clientX,
          startY: e.clientY,
          viewX: view.x,
          viewY: view.y,
        };
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } else if (e.button === 0 && (e.target as HTMLElement).dataset.canvasBg === "true") {
        // Clicked empty space → clear selection / cancel connecting.
        setSelectedId(null);
        setEditingId(null);
        setConnecting(null);
      }
    },
    [tool, view, handleAddNode],
  );

  const onContainerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.kind === "pan") {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        setView((v) => ({ ...v, x: drag.viewX + dx, y: drag.viewY + dy }));
        return;
      }
      if (drag?.kind === "node") {
        const c = screenToCanvas(e.clientX, e.clientY);
        const nx = Math.round(c.x - drag.offsetX);
        const ny = Math.round(c.y - drag.offsetY);
        setCanvas((cur) => ({
          ...cur,
          nodes: cur.nodes.map((n) => (n.id === drag.id ? { ...n, x: nx, y: ny } : n)),
        }));
        setDirty(true);
        return;
      }
      if (drag?.kind === "resize") {
        const c = screenToCanvas(e.clientX, e.clientY);
        setCanvas((cur) => ({
          ...cur,
          nodes: cur.nodes.map((n) => {
            if (n.id !== drag.id) return n;
            return {
              ...n,
              width: Math.max(80, Math.round(c.x - n.x)),
              height: Math.max(60, Math.round(c.y - n.y)),
            };
          }),
        }));
        setDirty(true);
        return;
      }
      if (connecting) {
        setMousePos({ x: e.clientX, y: e.clientY });
      }
    },
    [screenToCanvas, connecting],
  );

  const onContainerPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      // Cmd/Ctrl + wheel → zoom; otherwise pan.
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const focusX = e.clientX - rect.left;
        const focusY = e.clientY - rect.top;
        setView((v) => {
          const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
          const nextScale = Math.min(2.5, Math.max(0.25, v.scale * factor));
          // Keep focus point stable.
          const nx = focusX - (focusX - v.x) * (nextScale / v.scale);
          const ny = focusY - (focusY - v.y) * (nextScale / v.scale);
          return { x: nx, y: ny, scale: nextScale };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    },
    [],
  );

  // Suppress browser wheel scroll over canvas.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // ── Node drag start ──────────────────────────────────────────────
  const startNodeDrag = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      const node = canvas.nodes.find((n) => n.id === id);
      if (!node) return;
      const c = screenToCanvas(e.clientX, e.clientY);
      dragRef.current = {
        kind: "node",
        id,
        offsetX: c.x - node.x,
        offsetY: c.y - node.y,
      };
      setSelectedId(id);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [canvas.nodes, screenToCanvas],
  );

  const startResize = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      dragRef.current = { kind: "resize", id, corner: "br" };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [],
  );

  // ── Connection (edge) creation ────────────────────────────────────
  const onAnchorPointerDown = useCallback(
    (e: React.PointerEvent, nodeId: string, side: EdgeSide) => {
      e.stopPropagation();
      setConnecting({ from: nodeId, fromSide: side });
    },
    [],
  );

  const finishConnection = useCallback(
    (toId: string, toSide: EdgeSide) => {
      if (!connecting) return;
      if (connecting.from === toId) { setConnecting(null); return; }
      // Avoid duplicate edge.
      const exists = canvas.edges.some(
        (e) => e.fromNode === connecting.from && e.toNode === toId,
      );
      if (!exists) {
        update({
          ...canvas,
          edges: [
            ...canvas.edges,
            {
              id: newId("e"),
              fromNode: connecting.from,
              toNode: toId,
              fromSide: connecting.fromSide,
              toSide,
            },
          ],
        });
      }
      setConnecting(null);
    },
    [connecting, canvas, update],
  );

  // Cancel connecting on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConnecting(null);
        setEditingId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !editingId) {
        // Don't hijack typing into inputs.
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleDeleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, editingId, handleDeleteSelected, handleSave]);

  // ── Zoom buttons ─────────────────────────────────────────────────
  const zoomBy = (f: number) =>
    setView((v) => {
      const cont = containerRef.current;
      const cx = (cont?.clientWidth ?? 0) / 2;
      const cy = (cont?.clientHeight ?? 0) / 2;
      const next = Math.min(2.5, Math.max(0.25, v.scale * f));
      const nx = cx - (cx - v.x) * (next / v.scale);
      const ny = cy - (cy - v.y) * (next / v.scale);
      return { x: nx, y: ny, scale: next };
    });

  const fitAll = () => {
    if (canvas.nodes.length === 0) {
      setView({ x: 0, y: 0, scale: 1 });
      return;
    }
    const padding = 80;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of canvas.nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    }
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const w = rect.width - padding * 2;
    const h = rect.height - padding * 2;
    const sx = w / (maxX - minX);
    const sy = h / (maxY - minY);
    const scale = Math.min(2.5, Math.max(0.25, Math.min(sx, sy)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setView({
      x: rect.width / 2 - cx * scale,
      y: rect.height / 2 - cy * scale,
      scale,
    });
  };

  // ── Render ───────────────────────────────────────────────────────
  const selectedNode = useMemo(
    () => canvas.nodes.find((n) => n.id === selectedId) ?? null,
    [canvas.nodes, selectedId],
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-trevor-bg animate-fade-in">
      {/* Toolbar */}
      <div className="px-4 py-2 border-b border-trevor-border-subtle bg-trevor-bg-secondary flex items-center gap-1 flex-shrink-0">
        <ToolButton
          icon={MousePointer} label="Select (V)"
          active={tool === "select"} onClick={() => setTool("select")}
        />
        <Divider />
        <ToolButton
          icon={TypeIcon} label="Text card (T)"
          active={tool === "text"} onClick={() => setTool("text")}
        />
        <ToolButton
          icon={FileText} label="Note embed (N)"
          active={tool === "note"} onClick={() => setTool("note")}
        />
        <ToolButton
          icon={Link2} label="Link card (L)"
          active={tool === "link"} onClick={() => setTool("link")}
        />
        <ToolButton
          icon={Square} label="Group box (G)"
          active={tool === "group"} onClick={() => setTool("group")}
        />
        <Divider />
        {selectedNode && (
          <>
            <ColorMenu
              value={selectedNode.color}
              onChange={handleSetColor}
            />
            <ToolButton
              icon={Trash2} label="Delete (Del)"
              onClick={handleDeleteSelected}
              danger
            />
            <Divider />
          </>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-trevor-text-muted px-2">
          {canvas.nodes.length} node{canvas.nodes.length === 1 ? "" : "s"} · {canvas.edges.length} edge{canvas.edges.length === 1 ? "" : "s"} · {dirty ? "unsaved" : "saved"}
        </span>
        <ToolButton icon={ZoomOut} label="Zoom out" onClick={() => zoomBy(0.85)} />
        <span className="text-[11px] text-trevor-text-muted w-10 text-center tabular-nums">
          {Math.round(view.scale * 100)}%
        </span>
        <ToolButton icon={ZoomIn} label="Zoom in" onClick={() => zoomBy(1.15)} />
        <ToolButton icon={Maximize2} label="Fit all" onClick={fitAll} />
        <Divider />
        <ToolButton icon={Save} label="Save (⌘S)" onClick={handleSave} accent={dirty} />
        <ToolButton icon={X} label="Close" onClick={onClose} />
      </div>

      {/* Drawing surface */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        onPointerDown={onContainerPointerDown}
        onPointerMove={onContainerPointerMove}
        onPointerUp={onContainerPointerUp}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: tool === "select" ? "default" : "crosshair" }}
      >
        {/* Background dot grid */}
        <div
          data-canvas-bg="true"
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: `${24 * view.scale}px ${24 * view.scale}px`,
            backgroundPosition: `${view.x % (24 * view.scale)}px ${view.y % (24 * view.scale)}px`,
            opacity: 0.35,
          }}
        />

        {/* Camera */}
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            willChange: "transform",
          }}
        >
          {/* Group nodes render below everything else for layering. */}
          {canvas.nodes
            .filter((n) => n.type === "group")
            .map((n) => (
              <CanvasNodeView
                key={n.id}
                node={n}
                selected={n.id === selectedId}
                editing={editingId === n.id}
                vaultNotes={vaultNotes}
                onPointerDown={startNodeDrag}
                onStartResize={startResize}
                onPatch={(patch) => handleNodePatch(n.id, patch)}
                onStartEdit={() => setEditingId(n.id)}
                onStopEdit={() => setEditingId(null)}
                onAnchorDown={onAnchorPointerDown}
                onAnchorUp={finishConnection}
                onOpenNote={onOpenNote}
                connecting={!!connecting}
              />
            ))}

          {/* Edges as SVG overlay sized to the same coordinate space. */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: -100000, top: -100000, width: 200000, height: 200000, overflow: "visible" }}
          >
            <g transform="translate(100000,100000)">
              {canvas.edges.map((edge) => (
                <EdgeView
                  key={edge.id}
                  edge={edge}
                  nodes={canvas.nodes}
                />
              ))}
              {/* In-progress connect line. */}
              {connecting && mousePos && containerRef.current && (
                <ConnectingLine
                  from={getNodeAnchor(canvas.nodes, connecting.from, connecting.fromSide)}
                  toScreen={mousePos}
                  view={view}
                  containerRect={containerRef.current.getBoundingClientRect()}
                />
              )}
            </g>
          </svg>

          {/* Non-group nodes (rendered above edges visually due to DOM order). */}
          {canvas.nodes
            .filter((n) => n.type !== "group")
            .map((n) => (
              <CanvasNodeView
                key={n.id}
                node={n}
                selected={n.id === selectedId}
                editing={editingId === n.id}
                vaultNotes={vaultNotes}
                onPointerDown={startNodeDrag}
                onStartResize={startResize}
                onPatch={(patch) => handleNodePatch(n.id, patch)}
                onStartEdit={() => setEditingId(n.id)}
                onStopEdit={() => setEditingId(null)}
                onAnchorDown={onAnchorPointerDown}
                onAnchorUp={finishConnection}
                onOpenNote={onOpenNote}
                connecting={!!connecting}
              />
            ))}
        </div>

        {/* Empty-state coach-mark */}
        {canvas.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center max-w-md px-6">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-trevor-accent/10 border border-trevor-accent/30 flex items-center justify-center mb-3">
                <Plus size={20} className="text-trevor-accent" />
              </div>
              <h3 className="text-trevor-text text-[15px] font-medium mb-1">Empty canvas</h3>
              <p className="text-[12.5px] text-trevor-text-muted leading-relaxed">
                Pick a tool above and click anywhere to drop a card. Hold ⌘ + scroll to zoom, drag the background to pan.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Node renderer ──────────────────────────────────────────────────── */

interface NodeViewProps {
  node: CanvasNode;
  selected: boolean;
  editing: boolean;
  vaultNotes: Array<{ path: string; title: string }>;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onStartResize: (e: React.PointerEvent, id: string) => void;
  onPatch: (patch: Partial<CanvasNode>) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onAnchorDown: (e: React.PointerEvent, id: string, side: EdgeSide) => void;
  onAnchorUp: (id: string, side: EdgeSide) => void;
  onOpenNote: (path: string) => void;
  connecting: boolean;
}

function CanvasNodeView({
  node, selected, editing, vaultNotes,
  onPointerDown, onStartResize, onPatch, onStartEdit, onStopEdit,
  onAnchorDown, onAnchorUp, onOpenNote, connecting,
}: NodeViewProps) {
  const accent = resolveColor(node.color);
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
    borderColor: accent ?? "var(--color-border-strong)",
  };

  const ring = selected ? "ring-2 ring-trevor-accent ring-offset-0" : "";

  if (node.type === "group") {
    return (
      <div
        style={{
          ...baseStyle,
          background: accent ? `${accent}1a` : "rgba(124,92,255,0.06)",
          borderStyle: "dashed",
          borderWidth: 2,
          borderRadius: 14,
          pointerEvents: "auto",
        }}
        className={`${ring} group/canvas-node`}
        onPointerDown={(e) => onPointerDown(e, node.id)}
        onDoubleClick={onStartEdit}
      >
        {editing ? (
          <input
            autoFocus
            defaultValue={node.label ?? ""}
            onBlur={(e) => { onPatch({ label: e.target.value } as Partial<GroupCanvasNode>); onStopEdit(); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="m-2 px-2 py-1 bg-trevor-bg-elevated border border-trevor-border rounded text-[12px] text-trevor-text outline-none w-[calc(100%-1rem)]"
          />
        ) : (
          <div className="px-3 py-1.5 text-[11.5px] uppercase tracking-wider font-medium" style={{ color: accent ?? "var(--color-text-muted)" }}>
            {node.label ?? "Group"}
          </div>
        )}
        <ResizeHandle onPointerDown={(e) => onStartResize(e, node.id)} />
        <Anchors nodeId={node.id} onAnchorDown={onAnchorDown} onAnchorUp={onAnchorUp} highlight={connecting} />
      </div>
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        background: "var(--color-bg-tertiary)",
        border: `1px solid ${accent ?? "var(--color-border-strong)"}`,
        borderRadius: 10,
        boxShadow: selected
          ? "0 8px 28px rgba(0,0,0,0.45)"
          : "0 2px 8px rgba(0,0,0,0.35)",
        pointerEvents: "auto",
      }}
      className={`${ring} flex flex-col overflow-hidden`}
      onPointerDown={(e) => onPointerDown(e, node.id)}
      onDoubleClick={onStartEdit}
    >
      {/* Coloured top stripe when accent is set. */}
      {accent && <div style={{ height: 3, background: accent, flexShrink: 0 }} />}

      {/* Body per type */}
      {node.type === "text" && (
        editing ? (
          <textarea
            autoFocus
            defaultValue={node.text}
            onBlur={(e) => { onPatch({ text: e.target.value } as Partial<TextCanvasNode>); onStopEdit(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 w-full px-3 py-2 bg-transparent text-trevor-text text-[13px] resize-none outline-none"
            style={{ fontFamily: "var(--font-editor)" }}
          />
        ) : (
          <div
            className="flex-1 px-3 py-2 text-trevor-text text-[13px] whitespace-pre-wrap overflow-auto scrollbar-thin"
            style={{ fontFamily: "var(--font-editor)" }}
          >
            {node.text || <span className="text-trevor-text-muted italic">Empty card · double-click to edit</span>}
          </div>
        )
      )}

      {node.type === "note" && (
        <NoteCardBody
          node={node}
          vaultNotes={vaultNotes}
          editing={editing}
          onPatch={(p) => onPatch(p)}
          onStopEdit={onStopEdit}
          onOpen={() => onOpenNote(node.file)}
        />
      )}

      {node.type === "link" && (
        editing ? (
          <input
            autoFocus
            defaultValue={node.url}
            onBlur={(e) => { onPatch({ url: e.target.value } as Partial<LinkCanvasNode>); onStopEdit(); }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 px-3 py-2 bg-transparent text-trevor-accent text-[13px] outline-none"
          />
        ) : (
          <a
            href={node.url}
            target="_blank"
            rel="noopener"
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 flex items-center gap-2 px-3 py-2 text-trevor-accent text-[13px] hover:underline truncate"
            title={node.url}
          >
            <Link2 size={13} className="flex-shrink-0" />
            <span className="truncate">{node.url}</span>
          </a>
        )
      )}

      <ResizeHandle onPointerDown={(e) => onStartResize(e, node.id)} />
      <Anchors nodeId={node.id} onAnchorDown={onAnchorDown} onAnchorUp={onAnchorUp} highlight={connecting} />
    </div>
  );
}

/* Embedded note card content. */
function NoteCardBody({
  node, vaultNotes, editing, onPatch, onStopEdit, onOpen,
}: {
  node: NoteCanvasNode;
  vaultNotes: Array<{ path: string; title: string }>;
  editing: boolean;
  onPatch: (p: Partial<NoteCanvasNode>) => void;
  onStopEdit: () => void;
  onOpen: () => void;
}) {
  if (editing) {
    return (
      <div
        className="flex-1 p-2 flex flex-col gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <select
          autoFocus
          value={node.file}
          onChange={(e) => onPatch({ file: e.target.value })}
          onBlur={onStopEdit}
          className="w-full bg-trevor-bg-elevated border border-trevor-border rounded px-2 py-1.5 text-[12px] text-trevor-text outline-none focus:border-trevor-accent"
        >
          {vaultNotes.length === 0 && <option value="">No notes</option>}
          {vaultNotes.map((n) => (
            <option key={n.path} value={n.path}>{n.title}</option>
          ))}
        </select>
        <button
          onClick={onStopEdit}
          className="text-[11px] text-trevor-text-muted hover:text-trevor-text self-end"
        >
          Done
        </button>
      </div>
    );
  }
  const title = node.file?.split("/").pop()?.replace(/\.md$/, "") ?? "(no note)";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (node.file) onOpen(); }}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex-1 flex flex-col items-stretch text-left p-3 hover:bg-trevor-surface-hover/40 transition-colors"
    >
      <div className="flex items-center gap-2 text-trevor-text-muted text-[10.5px] uppercase tracking-wider font-medium mb-1">
        <FileText size={11} /> Note
      </div>
      <div className="text-trevor-text text-[14px] font-medium truncate">{title}</div>
      <div className="text-[11px] text-trevor-text-muted truncate">{node.file || "Double-click to choose a note"}</div>
      <div className="mt-auto flex items-center gap-1 text-[11px] text-trevor-accent self-end">
        Open <ArrowRight size={11} />
      </div>
    </button>
  );
}

/* ── Anchors (small handles on each side for connections) ──────────── */
function Anchors({
  nodeId, onAnchorDown, onAnchorUp, highlight,
}: {
  nodeId: string;
  onAnchorDown: (e: React.PointerEvent, id: string, side: EdgeSide) => void;
  onAnchorUp: (id: string, side: EdgeSide) => void;
  highlight: boolean;
}) {
  const sides: Array<{ side: EdgeSide; style: React.CSSProperties }> = [
    { side: "top",    style: { left: "50%", top: -6, transform: "translateX(-50%)" } },
    { side: "right",  style: { right: -6, top: "50%", transform: "translateY(-50%)" } },
    { side: "bottom", style: { left: "50%", bottom: -6, transform: "translateX(-50%)" } },
    { side: "left",   style: { left: -6, top: "50%", transform: "translateY(-50%)" } },
  ];
  return (
    <>
      {sides.map(({ side, style }) => (
        <div
          key={side}
          onPointerDown={(e) => onAnchorDown(e, nodeId, side)}
          onPointerUp={() => onAnchorUp(nodeId, side)}
          className={`absolute w-3 h-3 rounded-full bg-trevor-accent border-2 border-trevor-bg-tertiary transition-opacity ${
            highlight ? "opacity-100" : "opacity-0 group-hover/canvas-node:opacity-100 hover:opacity-100"
          }`}
          style={{ ...style, cursor: "crosshair", zIndex: 5 }}
          title={`Connect from ${side}`}
        />
      ))}
    </>
  );
}

function ResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute w-3 h-3 right-0 bottom-0 cursor-nwse-resize"
      style={{
        background: "linear-gradient(135deg, transparent 50%, var(--color-border-strong) 50%)",
      }}
      title="Resize"
    />
  );
}

/* ── Edge rendering ─────────────────────────────────────────────────── */

function EdgeView({ edge, nodes }: { edge: CanvasEdge; nodes: CanvasNode[] }) {
  const from = nodes.find((n) => n.id === edge.fromNode);
  const to = nodes.find((n) => n.id === edge.toNode);
  if (!from || !to) return null;
  const a = anchorPoint(from, edge.fromSide ?? autoSide(from, to));
  const b = anchorPoint(to, edge.toSide ?? autoSide(to, from));
  const color = resolveColor(edge.color) ?? "var(--color-text-muted)";
  const path = orthoPath(a, b);
  return (
    <g>
      <path
        d={path}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        markerEnd="url(#trevor-arrow)"
      />
      {edge.label && (
        <text
          x={(a.x + b.x) / 2}
          y={(a.y + b.y) / 2 - 4}
          textAnchor="middle"
          fontSize={10}
          fill="var(--color-text-secondary)"
          style={{ pointerEvents: "none" }}
        >
          {edge.label}
        </text>
      )}
      {/* Arrow head defined once (cheap to repeat in each edge group). */}
      <defs>
        <marker id="trevor-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
    </g>
  );
}

function ConnectingLine({
  from, toScreen, view, containerRect,
}: {
  from: { x: number; y: number };
  toScreen: { x: number; y: number };
  view: { x: number; y: number; scale: number };
  containerRect: DOMRect;
}) {
  const tx = (toScreen.x - containerRect.left - view.x) / view.scale;
  const ty = (toScreen.y - containerRect.top - view.y) / view.scale;
  const path = orthoPath(from, { x: tx, y: ty });
  return (
    <path
      d={path}
      stroke="var(--color-accent)"
      strokeWidth={1.6}
      strokeDasharray="6 4"
      fill="none"
    />
  );
}

function getNodeAnchor(nodes: CanvasNode[], id: string, side: EdgeSide) {
  const n = nodes.find((x) => x.id === id);
  if (!n) return { x: 0, y: 0 };
  return anchorPoint(n, side);
}

function anchorPoint(n: CanvasNode, side: EdgeSide): { x: number; y: number } {
  switch (side) {
    case "top":    return { x: n.x + n.width / 2, y: n.y };
    case "right":  return { x: n.x + n.width,     y: n.y + n.height / 2 };
    case "bottom": return { x: n.x + n.width / 2, y: n.y + n.height };
    case "left":   return { x: n.x,               y: n.y + n.height / 2 };
  }
}

/** Pick the best edge side based on relative node positions. */
function autoSide(from: CanvasNode, to: CanvasNode): EdgeSide {
  const dx = (to.x + to.width / 2) - (from.x + from.width / 2);
  const dy = (to.y + to.height / 2) - (from.y + from.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

/** Orthogonal Bézier path between two points. */
function orthoPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x;
  const cx1 = a.x + dx * 0.5;
  const cx2 = b.x - dx * 0.5;
  return `M ${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`;
}

/* ── Toolbar atoms ─────────────────────────────────────────────────── */

function ToolButton({
  icon: Icon, label, active, onClick, danger, accent,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-trevor-accent/20 text-trevor-accent"
          : danger
            ? "text-trevor-text-muted hover:text-trevor-danger hover:bg-trevor-danger/10"
            : accent
              ? "text-trevor-accent hover:bg-trevor-surface-hover"
              : "text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover"
      }`}
    >
      <Icon size={14} />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-trevor-border mx-1 flex-shrink-0" />;
}

function ColorMenu({
  value, onChange,
}: { value?: string; onChange: (color: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Card colour"
        className="p-1.5 rounded text-trevor-text-muted hover:text-trevor-text hover:bg-trevor-surface-hover transition-colors flex items-center gap-1"
      >
        <Palette size={14} />
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: resolveColor(value) ?? "transparent", border: "1px solid var(--color-border)" }}
        />
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 bg-trevor-bg-elevated border border-trevor-border rounded-md shadow-elevation-2 p-2 w-44 animate-fade-in">
          <div className="grid grid-cols-6 gap-1 mb-2">
            {CANVAS_COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                title={c.label}
                className="w-6 h-6 rounded-full border border-trevor-border hover:scale-110 transition-transform"
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-[11px] text-trevor-text-muted hover:text-trevor-text px-2 py-1 rounded hover:bg-trevor-surface-hover transition-colors"
          >
            No colour
          </button>
        </div>
      )}
    </div>
  );
}
