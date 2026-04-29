/**
 * Trevor — Graph helpers
 *
 * Walks a tree of notes, parses their content, and produces a
 * { nodes, links } payload for the GraphView.  Nodes are .md files;
 * edges are [[wiki-links]] between notes.
 */
import type { TreeNode } from "@/lib/fs/types";
import { extractWikiLinks, extractTags } from "@/lib/markdown/renderer";
import type { GraphNode, GraphLink } from "@/components/graph/GraphView";

/** Recursively flatten a tree to all `.md` notes. */
export function flattenNotes(node: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    if (n.kind === "file" && n.name.endsWith(".md")) out.push(n);
    n.children?.forEach(walk);
  };
  walk(node);
  return out;
}

/** Build a graph from a vault tree + a map of (path → file content). */
export function buildGraph(
  tree: TreeNode,
  contents: Map<string, string>,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const notes = flattenNotes(tree);

  // Map note title (no extension) → path so wiki-links resolve.
  const titleIndex = new Map<string, string>();
  for (const n of notes) {
    const title = n.name.replace(/\.md$/i, "");
    titleIndex.set(title.toLowerCase(), n.path);
  }

  // First pass: build links and count incoming references for sizing.
  const linkSet = new Set<string>();
  const links: GraphLink[] = [];
  const incoming = new Map<string, number>();

  for (const note of notes) {
    const content = contents.get(note.path) ?? "";
    const targets = extractWikiLinks(content);
    for (const t of targets) {
      const targetPath = titleIndex.get(t.toLowerCase());
      if (!targetPath || targetPath === note.path) continue;
      const key = `${note.path}→${targetPath}`;
      if (linkSet.has(key)) continue;
      linkSet.add(key);
      links.push({ source: note.path, target: targetPath });
      incoming.set(targetPath, (incoming.get(targetPath) ?? 0) + 1);
    }
  }

  // Build nodes with size derived from incoming refs.
  const nodes: GraphNode[] = notes.map((n) => {
    const refs = incoming.get(n.path) ?? 0;
    const content = contents.get(n.path) ?? "";
    return {
      id: n.path,
      label: n.name.replace(/\.md$/i, ""),
      size: Math.min(refs, 6),
      tags: extractTags(content),
    };
  });

  return { nodes, links };
}

/** Collect every #tag across all notes in the vault. */
export function collectAllTags(contents: Map<string, string>): string[] {
  const all = new Set<string>();
  for (const c of contents.values()) {
    for (const t of extractTags(c)) all.add(t);
  }
  return Array.from(all).sort((a, b) => a.localeCompare(b));
}
