/**
 * FlowCanvas.tsx -- SVG-backed top-down flowchart for the decision tree.
 * Replaces the old horizontal recursive TreeNode dump.
 *
 * Features:
 *  - Top-down layout (question depth flows downward)
 *  - SVG bezier edges with option labels
 *  - Zoom in / out / fit-to-screen controls
 *  - Pan via mouse drag
 *  - Collapsible branches per question node
 *  - Click treatment to highlight all ancestor paths
 *  - Hover tooltip for truncated labels
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { computeFlowLayout } from './FlowLayout';
import type { LayoutNode, LayoutEdge } from './FlowLayout';
import type { Question } from '../../types/question';
import type { Treatment } from '../../types/treatment';
import type { Bundle } from '../../types/bundle';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FlowCanvasProps {
  questions: Record<string, Question>;
  treatments: Record<string, Treatment>;
  bundles: Record<string, Bundle>;
  onSelectNode?: (id: string, kind: string) => void;
}

// ── Highlight path computation ────────────────────────────────────────────────

/**
 * Given a clicked leaf node key, walk UP the edge list to collect all ancestor
 * node keys and edge keys that form any path to the selected leaf.
 */
function computeHighlightedKeys(
  clickedKey: string,
  nodes: LayoutNode[],
  edges: LayoutEdge[],
): { nodeKeys: Set<string>; edgeKeys: Set<string> } {
  const nodeKeys = new Set<string>();
  const edgeKeys = new Set<string>();
  const edgeKey = (e: LayoutEdge) => `${e.fromKey}--${e.toKey}`;

  // Build parent map: childKey -> edge
  const parentEdgeMap = new Map<string, LayoutEdge>();
  for (const e of edges) {
    parentEdgeMap.set(e.toKey, e);
  }

  // Walk up from the clicked node
  function walkUp(key: string): void {
    nodeKeys.add(key);
    const parentEdge = parentEdgeMap.get(key);
    if (parentEdge) {
      edgeKeys.add(edgeKey(parentEdge));
      walkUp(parentEdge.fromKey);
    }
  }

  walkUp(clickedKey);
  return { nodeKeys, edgeKeys };
}

// ── FlowCanvas ────────────────────────────────────────────────────────────────

export function FlowCanvas({ questions, treatments, bundles, onSelectNode }: FlowCanvasProps): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan / zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Collapsed question node keys
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Highlighted node (treatment/bundle leaf) and its ancestor path
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  // Tooltip
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Whether user is currently dragging the canvas
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOrigin = useRef({ x: 0, y: 0 });

  // Compute full layout
  const layout = useMemo(
    () => computeFlowLayout(questions, treatments, bundles),
    [questions, treatments, bundles],
  );

  // Compute which nodes are hidden due to collapsed ancestors
  const hiddenKeys = useMemo((): Set<string> => {
    if (collapsed.size === 0) return new Set();
    const hidden = new Set<string>();

    // Build child->parent key map for fast ancestor lookup
    const nodeByKey = new Map<string, LayoutNode>();
    for (const n of layout.nodes) nodeByKey.set(n.key, n);

    // For each collapsed question, hide all descendants
    function hideDescendants(questionKey: string): void {
      const node = nodeByKey.get(questionKey);
      if (!node) return;
      for (const childKey of node.childKeys) {
        hidden.add(childKey);
        hideDescendants(childKey);
      }
    }

    for (const collapsedKey of collapsed) {
      hideDescendants(collapsedKey);
    }

    return hidden;
  }, [collapsed, layout.nodes]);

  // Compute highlight sets
  const { highlightedNodeKeys, highlightedEdgeKeys } = useMemo(() => {
    if (!highlightedKey) return { highlightedNodeKeys: null, highlightedEdgeKeys: null };
    const { nodeKeys, edgeKeys } = computeHighlightedKeys(highlightedKey, layout.nodes, layout.edges);
    return { highlightedNodeKeys: nodeKeys, highlightedEdgeKeys: edgeKeys };
  }, [highlightedKey, layout.nodes, layout.edges]);

  // Fit-to-screen helper
  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container || layout.totalWidth === 0 || layout.totalHeight === 0) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scaleX = cw / layout.totalWidth;
    const scaleY = ch / layout.totalHeight;
    const newZoom = Math.min(scaleX, scaleY, 1);  // never scale up beyond 1x
    const offsetX = (cw - layout.totalWidth * newZoom) / 2;
    const offsetY = (ch - layout.totalHeight * newZoom) / 2;

    setZoom(newZoom);
    setPan({ x: offsetX, y: offsetY });
  }, [layout.totalWidth, layout.totalHeight]);

  // Fit on first render
  useEffect(() => {
    // Small defer to let the container measure itself
    const id = requestAnimationFrame(fitToScreen);
    return () => cancelAnimationFrame(id);
  }, [fitToScreen]);

  // ── Zoom controls ─────────────────────────────────────────────────────────

  function handleZoomIn(): void {
    setZoom((z) => Math.min(z * 1.2, 4));
  }

  function handleZoomOut(): void {
    setZoom((z) => Math.max(z / 1.2, 0.1));
  }

  // ── Pan (mouse drag) ──────────────────────────────────────────────────────

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    // Only pan when clicking on the background (not a node button)
    if ((e.target as HTMLElement).closest('.wdd-flow-node')) return;
    if ((e.target as HTMLElement).closest('.wdd-flow-collapse-btn')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    panOrigin.current = { ...pan };
    e.preventDefault();
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>): void {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panOrigin.current.x + dx, y: panOrigin.current.y + dy });
  }

  function handleMouseUp(): void {
    isPanning.current = false;
  }

  // ── Node interactions ─────────────────────────────────────────────────────

  function handleNodeClick(node: LayoutNode, e: React.MouseEvent): void {
    e.stopPropagation();

    if (node.kind === 'treatment' || node.kind === 'bundle') {
      const isAlreadyHighlighted = highlightedKey === node.key;
      setHighlightedKey(isAlreadyHighlighted ? null : node.key);
      if (!isAlreadyHighlighted && onSelectNode) {
        onSelectNode(node.id, node.kind);
      }
    } else if (node.kind === 'question' || node.kind === 'symptoms') {
      // Clear highlight when clicking a question
      setHighlightedKey(null);
      if (onSelectNode) {
        onSelectNode(node.id, node.kind);
      }
    }
  }

  function handleBackgroundClick(): void {
    setHighlightedKey(null);
  }

  function handleCollapseClick(nodeKey: string, e: React.MouseEvent): void {
    e.stopPropagation();
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }

  // ── Tooltip handlers ──────────────────────────────────────────────────────

  function handleNodeMouseEnter(node: LayoutNode, e: React.MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      text: node.sublabel ? `${node.label} -- ${node.sublabel}` : node.label,
      x: rect.left,
      y: rect.bottom + 6,
    });
  }

  function handleNodeMouseLeave(): void {
    setTooltip(null);
  }

  // ── Rendering helpers ─────────────────────────────────────────────────────

  function edgeKey(e: LayoutEdge): string {
    return `${e.fromKey}--${e.toKey}`;
  }

  function isNodeDimmed(node: LayoutNode): boolean {
    if (!highlightedNodeKeys) return false;
    return !highlightedNodeKeys.has(node.key);
  }

  function isEdgeDimmed(edge: LayoutEdge): boolean {
    if (!highlightedEdgeKeys) return false;
    return !highlightedEdgeKeys.has(edgeKey(edge));
  }

  function nodeClasses(node: LayoutNode): string {
    const parts = ['wdd-flow-node', `wdd-flow-node--${node.kind}`];
    if (highlightedNodeKeys) {
      if (highlightedNodeKeys.has(node.key)) {
        parts.push('wdd-flow-node--highlighted');
      } else {
        parts.push('wdd-flow-node--dimmed');
      }
    }
    return parts.join(' ');
  }

  function buildEdgePath(edge: LayoutEdge): string {
    const midY = (edge.fromY + edge.toY) / 2;
    return `M ${edge.fromX} ${edge.fromY} C ${edge.fromX} ${midY}, ${edge.toX} ${midY}, ${edge.toX} ${edge.toY}`;
  }

  // ── Visible nodes/edges (respects collapse) ───────────────────────────────

  const visibleNodes = layout.nodes.filter((n) => !hiddenKeys.has(n.key));
  const visibleEdges = layout.edges.filter(
    (e) => !hiddenKeys.has(e.fromKey) && !hiddenKeys.has(e.toKey),
  );

  // ── Count hidden children for collapsed nodes ─────────────────────────────

  function countHiddenDescendants(nodeKey: string): number {
    let count = 0;
    const nodeByKey = new Map<string, LayoutNode>();
    for (const n of layout.nodes) nodeByKey.set(n.key, n);

    function countLeaves(key: string): void {
      const n = nodeByKey.get(key);
      if (!n) return;
      if (n.childKeys.length === 0) {
        count++;
      } else {
        for (const ck of n.childKeys) countLeaves(ck);
      }
    }

    const node = nodeByKey.get(nodeKey);
    if (node) {
      for (const ck of node.childKeys) countLeaves(ck);
    }
    return count;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="wdd-flow-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleBackgroundClick}
      style={{ cursor: isPanning.current ? 'grabbing' : 'grab' }}
    >
      {/* Pan+zoom inner canvas */}
      <div
        className="wdd-flow-inner"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          width: layout.totalWidth,
          height: layout.totalHeight,
        }}
      >
        {/* SVG edge layer */}
        <svg
          className="wdd-flow-svg"
          style={{ width: layout.totalWidth, height: layout.totalHeight }}
        >
          {visibleEdges.map((edge) => {
            const dimmed = isEdgeDimmed(edge);
            const highlighted = highlightedEdgeKeys?.has(edgeKey(edge)) ?? false;
            return (
              <g key={edgeKey(edge)}>
                <path
                  d={buildEdgePath(edge)}
                  fill="none"
                  stroke={highlighted ? 'var(--wdd-accent)' : '#cbd5e1'}
                  strokeWidth={highlighted ? 2 : 1.5}
                  opacity={dimmed ? 0.15 : 1}
                  style={{ transition: 'opacity 0.2s, stroke 0.2s' }}
                />
              </g>
            );
          })}
        </svg>

        {/* Edge labels -- rendered as positioned divs on top of SVG */}
        {visibleEdges.map((edge) => {
          if (!edge.label) return null;
          const midX = (edge.fromX + edge.toX) / 2 - 60;
          const midY = (edge.fromY + edge.toY) / 2 - 8;
          const dimmed = isEdgeDimmed(edge);
          return (
            <div
              key={`label-${edgeKey(edge)}`}
              className="wdd-flow-edge-label"
              style={{
                left: midX,
                top: midY,
                opacity: dimmed ? 0.15 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {edge.label}
            </div>
          );
        })}

        {/* Nodes */}
        {visibleNodes.map((node) => {
          const isCollapsed = collapsed.has(node.key);

          return (
            <div
              key={node.key}
              className={nodeClasses(node)}
              data-category={node.category ?? undefined}
              style={{
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
              }}
              onClick={(e) => handleNodeClick(node, e)}
              onMouseEnter={(e) => handleNodeMouseEnter(node, e)}
              onMouseLeave={handleNodeMouseLeave}
            >
              <div className="wdd-flow-node-label">{node.label}</div>
              {node.sublabel && (
                <div className="wdd-flow-node-sublabel">{node.sublabel}</div>
              )}
              {node.kind === 'shared-ref' && (
                <div className="wdd-flow-node-sublabel" style={{ fontStyle: 'italic' }}>
                  see above
                </div>
              )}

              {/* Collapse/expand button for question nodes */}
              {node.collapsible && (
                <button
                  className="wdd-flow-collapse-btn"
                  title={isCollapsed ? 'Expand branch' : 'Collapse branch'}
                  onClick={(e) => handleCollapseClick(node.key, e)}
                  aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? '\u25B6' : '\u25BC'}
                </button>
              )}
            </div>
          );
        })}

        {/* Collapsed stubs -- one per collapsed question */}
        {Array.from(collapsed).map((collapsedKey) => {
          const node = layout.nodes.find((n) => n.key === collapsedKey);
          if (!node) return null;
          const hiddenCount = countHiddenDescendants(collapsedKey);
          const stubY = node.y + node.height + 20;
          const stubX = node.x + node.width / 2 - 70;
          return (
            <div
              key={`stub-${collapsedKey}`}
              className="wdd-flow-node wdd-flow-node--shared"
              style={{
                left: stubX,
                top: stubY,
                width: 140,
                height: 36,
                fontSize: 11,
                opacity: 0.7,
              }}
              onClick={(e) => { e.stopPropagation(); handleCollapseClick(collapsedKey, e); }}
            >
              <div className="wdd-flow-node-label" style={{ fontSize: 11 }}>
                {hiddenCount} treatment{hiddenCount !== 1 ? 's' : ''} hidden
              </div>
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="wdd-flow-controls">
        <button
          className="wdd-flow-control-btn"
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="wdd-flow-control-btn"
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          className="wdd-flow-control-btn"
          onClick={fitToScreen}
          title="Fit to screen"
          aria-label="Fit to screen"
          style={{ fontSize: 12 }}
        >
          []
        </button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: '#1e293b',
            color: '#f1f5f9',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 100,
            maxWidth: 320,
            wordBreak: 'break-word',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
