/**
 * Trevor — JSON Canvas Types
 *
 * Closely follows the JSON Canvas v1.0 spec (https://jsoncanvas.org/).
 * A canvas file is plain JSON, persisted next to .md files in the
 * vault as `<name>.canvas`.
 */

export type CanvasNodeType = "text" | "note" | "link" | "group";
export type CanvasColor =
  | "1" | "2" | "3" | "4" | "5" | "6" // preset palette indices (1=red, 2=orange, …)
  | string;                          // raw hex e.g. "#7c5cff"

export interface CanvasNodeBase {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
}

export interface TextCanvasNode extends CanvasNodeBase {
  type: "text";
  text: string;
}

/** A reference to a markdown note inside the vault. */
export interface NoteCanvasNode extends CanvasNodeBase {
  type: "note";
  /** Path to the .md file (relative to the vault root). */
  file: string;
}

export interface LinkCanvasNode extends CanvasNodeBase {
  type: "link";
  url: string;
}

/** Bounding box that visually groups other nodes. */
export interface GroupCanvasNode extends CanvasNodeBase {
  type: "group";
  label?: string;
}

export type CanvasNode =
  | TextCanvasNode
  | NoteCanvasNode
  | LinkCanvasNode
  | GroupCanvasNode;

export type EdgeSide = "top" | "right" | "bottom" | "left";

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: EdgeSide;
  toSide?: EdgeSide;
  label?: string;
  color?: CanvasColor;
}

export interface CanvasFile {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export const EMPTY_CANVAS: CanvasFile = { nodes: [], edges: [] };

/** Parse a `.canvas` file content; returns `EMPTY_CANVAS` on failure. */
export function parseCanvas(text: string): CanvasFile {
  if (!text.trim()) return { ...EMPTY_CANVAS };
  try {
    const obj = JSON.parse(text) as Partial<CanvasFile>;
    const nodes = Array.isArray(obj.nodes) ? obj.nodes : [];
    const edges = Array.isArray(obj.edges) ? obj.edges : [];
    return { nodes: nodes.filter(isValidNode), edges: edges.filter(isValidEdge) };
  } catch {
    return { ...EMPTY_CANVAS };
  }
}

export function stringifyCanvas(canvas: CanvasFile): string {
  return JSON.stringify(canvas, null, 2);
}

function isValidNode(n: unknown): n is CanvasNode {
  if (!n || typeof n !== "object") return false;
  const o = n as Record<string, unknown>;
  return typeof o.id === "string" &&
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.width === "number" &&
    typeof o.height === "number" &&
    typeof o.type === "string";
}

function isValidEdge(e: unknown): e is CanvasEdge {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return typeof o.id === "string" &&
    typeof o.fromNode === "string" &&
    typeof o.toNode === "string";
}

let nextId = 1;
export function newId(prefix = "n"): string {
  nextId++;
  return `${prefix}-${Date.now().toString(36)}-${nextId.toString(36)}`;
}

/** Standard preset colours for canvas elements. */
export const CANVAS_COLORS: Array<{ id: string; label: string; hex: string }> = [
  { id: "1", label: "Red",    hex: "#ef4444" },
  { id: "2", label: "Orange", hex: "#f97316" },
  { id: "3", label: "Yellow", hex: "#eab308" },
  { id: "4", label: "Green",  hex: "#22c55e" },
  { id: "5", label: "Cyan",   hex: "#06b6d4" },
  { id: "6", label: "Purple", hex: "#a855f7" },
];

export function resolveColor(c?: CanvasColor): string | null {
  if (!c) return null;
  const preset = CANVAS_COLORS.find((p) => p.id === c);
  if (preset) return preset.hex;
  if (c.startsWith("#")) return c;
  return null;
}
