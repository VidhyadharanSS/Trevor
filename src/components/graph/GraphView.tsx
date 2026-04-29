/**
 * Trevor — Graph View
 *
 * A force-directed visualisation of notes connected by [[wiki-links]].
 * Built with D3-force; renders to <svg> for crisp scaling.
 *
 * Props give it the dataset (notes + edges) and a click handler for
 * navigation.  The component is fully self-contained: it re-runs the
 * simulation whenever the data changes and tears down listeners on unmount.
 */
import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { X, ZoomIn, ZoomOut, Maximize2, Filter } from "lucide-react";

export interface GraphNode {
  id: string;        // unique = note path
  label: string;     // display name
  size: number;      // scaled by # references
  tags?: string[];
  // d3-force populated:
  x?: number; y?: number; fx?: number | null; fy?: number | null;
}

/**
 * Edge in the graph.  After `forceLink.id()` resolves, d3 mutates
 * source/target into actual GraphNode objects, so the field is
 * loosely typed here to satisfy d3's SimulationLinkDatum.
 */
export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphViewProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick: (id: string) => void;
  onClose: () => void;
}

export function GraphView({ nodes, links, onNodeClick, onClose }: GraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("");
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Filter the dataset by the search input.
  const { fNodes, fLinks } = useMemo(() => {
    if (!filter.trim()) return { fNodes: nodes, fLinks: links };
    const q = filter.toLowerCase();
    const visibleIds = new Set(
      nodes
        .filter((n) => n.label.toLowerCase().includes(q) || (n.tags ?? []).some((t) => t.includes(q)))
        .map((n) => n.id),
    );
    return {
      fNodes: nodes.filter((n) => visibleIds.has(n.id)),
      fLinks: links.filter((l) => visibleIds.has(l.source as string) && visibleIds.has(l.target as string)),
    };
  }, [nodes, links, filter]);

  useEffect(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous render.
    d3.select(svg).selectAll("*").remove();

    // Read accent colour from CSS so the graph adapts to active theme.
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim() ||
      "#7c5cff";
    const text =
      getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() ||
      "#e4e4e7";
    const muted =
      getComputedStyle(document.documentElement).getPropertyValue("--color-text-muted").trim() ||
      "#71717a";

    const root = d3.select(svg)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("background", "transparent");

    // Zoom container (pan + scroll-zoom).
    const zoomLayer = root.append("g").attr("class", "zoom-layer");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => zoomLayer.attr("transform", event.transform));
    root.call(zoom);

    // Simulation.
    const simNodes = fNodes.map((n) => ({ ...n }));
    const simLinks = fLinks.map((l) => ({ ...l }));

    const simulation = d3.forceSimulation<GraphNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(simLinks)
          .id((d) => d.id)
          .distance(80)
          .strength(0.5),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide<GraphNode>().radius((d) => 8 + d.size * 2));

    // Edges.
    const link = zoomLayer.append("g")
      .attr("stroke", muted)
      .attr("stroke-opacity", 0.35)
      .selectAll("line")
      .data(simLinks)
      .enter().append("line")
      .attr("stroke-width", 1);

    // Nodes.
    const node = zoomLayer.append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(simNodes)
      .enter().append("circle")
      .attr("r", (d) => 5 + d.size * 1.8)
      .attr("fill", accent)
      .attr("fill-opacity", 0.85)
      .attr("stroke", accent)
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("click", (_event, d) => onNodeClick(d.id))
      .on("mouseenter", function (_event, d) {
        d3.select(this).attr("fill-opacity", 1).attr("r", (5 + d.size * 1.8) * 1.3);
        setHoveredNode(d);
      })
      .on("mouseleave", function (_event, d) {
        d3.select(this).attr("fill-opacity", 0.85).attr("r", 5 + d.size * 1.8);
        setHoveredNode(null);
      });

    // Drag behaviour.
    node.call(
      d3.drag<SVGCircleElement, GraphNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }),
    );

    // Labels.
    const labels = zoomLayer.append("g")
      .selectAll("text")
      .data(simNodes)
      .enter().append("text")
      .text((d) => d.label)
      .attr("font-size", "11px")
      .attr("font-family", "var(--font-ui)")
      .attr("fill", text)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => 5 + d.size * 1.8 + 12)
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Tick → keep things on screen.
    // After forceLink resolves, d.source / d.target are the GraphNode
    // objects (d3 mutates them in place from the original string ids).
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as unknown as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as unknown as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as unknown as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as unknown as GraphNode).y ?? 0);
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      labels.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    // Expose zoom helpers to outer buttons via dataset.
    (svg as unknown as { __zoom: typeof zoom }).__zoom = zoom;

    return () => {
      simulation.stop();
    };
  }, [fNodes, fLinks, onNodeClick]);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const inst = (svg as unknown as { __zoom?: d3.ZoomBehavior<SVGSVGElement, unknown> }).__zoom;
    if (!inst) return;
    d3.select(svg).transition().duration(200).call(inst.scaleBy, factor);
  };

  const resetZoom = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const inst = (svg as unknown as { __zoom?: d3.ZoomBehavior<SVGSVGElement, unknown> }).__zoom;
    if (!inst) return;
    d3.select(svg).transition().duration(200).call(inst.transform, d3.zoomIdentity);
  };

  return (
    <div className="fixed inset-0 z-40 bg-trevor-bg flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-5 py-3 border-b border-trevor-border-subtle flex items-center justify-between bg-trevor-bg-secondary">
        <div className="flex items-center gap-3">
          <h2 className="text-[14px] font-semibold text-trevor-text">Graph view</h2>
          <span className="text-[11px] text-trevor-text-muted">
            {fNodes.length} note{fNodes.length === 1 ? "" : "s"} ·{" "}
            {fLinks.length} link{fLinks.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Filter size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-trevor-text-muted pointer-events-none" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter…"
              className="bg-trevor-bg-elevated border border-trevor-border rounded pl-7 pr-2 py-1 text-[12px] text-trevor-text outline-none focus:border-trevor-accent w-44"
            />
          </div>
          <button onClick={() => zoomBy(1.2)} className="p-1.5 rounded text-trevor-text-muted hover:bg-trevor-surface-hover" title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button onClick={() => zoomBy(0.8)} className="p-1.5 rounded text-trevor-text-muted hover:bg-trevor-surface-hover" title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button onClick={resetZoom} className="p-1.5 rounded text-trevor-text-muted hover:bg-trevor-surface-hover" title="Fit">
            <Maximize2 size={14} />
          </button>
          <button onClick={onClose} className="p-1.5 rounded text-trevor-text-muted hover:bg-trevor-surface-hover" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} className="w-full h-full" />

        {fNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-trevor-text-muted text-[13px]">
            No notes match this filter.
          </div>
        )}

        {hoveredNode && (
          <div className="absolute bottom-4 left-4 px-3 py-2 bg-trevor-bg-elevated border border-trevor-border rounded-md shadow-elevation-1 text-[12px] text-trevor-text">
            <strong>{hoveredNode.label}</strong>
            <div className="text-trevor-text-muted text-[10.5px] mt-0.5">
              {hoveredNode.id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
