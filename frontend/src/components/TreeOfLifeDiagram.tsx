"use client";
import React, { useState } from "react";
import type { TreeOfLifeNode, TreePath } from "@/lib/about-content";
import { TREE_VIEWBOX, TREE_VIEWBOX_HEIGHT, TREE_VIEWBOX_WIDTH } from "@/lib/about-content";

interface TreeOfLifeDiagramProps {
  nodes: TreeOfLifeNode[];
  paths: readonly TreePath[];
  /** Name of a sephira whose popup is pinned open on first render */
  initial?: string;
}

const NODE_RADIUS = 26;
const HIDDEN_RADIUS = 22;

/**
 * The Tree of Life as an inline SVG: 22 paths under 11 sephiroth. Hovering or focusing a
 * node opens a popup with that zone's description; a click or tap pins it (useful where
 * there is no hover). Nodes are <g role="button"> so they are keyboard-focusable in Chrome
 * and Safari without foreignObject. The popup is HTML positioned over the svg so its text
 * wraps, and it ignores the pointer so it never steals the hover from the node beneath.
 */
const TreeOfLifeDiagram: React.FC<TreeOfLifeDiagramProps> = ({
  nodes,
  paths,
  initial,
}) => {
  const [pinned, setPinned] = useState<string | null>(initial ?? null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const byName = new Map(nodes.map((n) => [n.name, n]));
  const activeName = hovered ?? focused ?? pinned;
  const active = activeName ? byName.get(activeName) : undefined;

  // Hover and focus outrank the pin, so unpinning also drops them or the popup would stay.
  const togglePin = (name: string) => {
    if (pinned === name) {
      setPinned(null);
      setHovered(null);
      setFocused(null);
    } else {
      setPinned(name);
    }
  };

  const onKeyDown = (name: string) => (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      togglePin(name);
    } else if (e.key === "Escape") {
      setPinned(null);
      setFocused(null);
    }
  };

  // The popup's placement lives in tarot.css (.tree-popup): phones put it under upper nodes
  // and over lower ones; wide screens put it beside the tree, level with the node. The
  // component only supplies the node's position as CSS variables and the half it is in.
  const popupStyle = (node: TreeOfLifeNode): React.CSSProperties =>
    ({
      "--node-x": `${(node.x / TREE_VIEWBOX_WIDTH) * 100}%`,
      "--node-y": `${(node.y / TREE_VIEWBOX_HEIGHT) * 100}%`,
    }) as React.CSSProperties;
  const popupSide = (node: TreeOfLifeNode): string =>
    node.y <= TREE_VIEWBOX_HEIGHT / 2 ? "tree-popup--below" : "tree-popup--above";

  return (
    <div className="relative w-full max-w-[260px] sm:max-w-[300px] mx-auto">
      <svg viewBox={TREE_VIEWBOX} role="group" aria-label="Tree of Life" className="block w-full h-auto">
        {/* Paths first so the filled circles cover the Kether–Tiphereth line under Daath */}
        {paths.map(([a, b]) => {
          const from = byName.get(a);
          const to = byName.get(b);
          if (!from || !to) return null;
          return (
            <line
              key={`${a}-${b}`}
              className="tree-path"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#d4af37"
              strokeOpacity={0.45}
              strokeWidth={1}
            />
          );
        })}
        {nodes.map((node) => {
          const isPinned = node.name === pinned;
          const isActive = node.name === activeName;
          return (
            <g
              key={node.name}
              className={`tree-node${isActive ? " tree-node--active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={isPinned}
              aria-label={node.name}
              aria-describedby={isActive ? `sephira-${node.name}` : undefined}
              data-sephira={node.name}
              onClick={() => togglePin(node.name)}
              onKeyDown={onKeyDown(node.name)}
              onMouseEnter={() => setHovered(node.name)}
              onMouseLeave={() => setHovered((h) => (h === node.name ? null : h))}
              onFocus={() => setFocused(node.name)}
              onBlur={() => setFocused((f) => (f === node.name ? null : f))}
            >
              <circle
                className="tree-node__ring"
                cx={node.x}
                cy={node.y}
                r={node.hidden ? HIDDEN_RADIUS : NODE_RADIUS}
                fill={isActive ? "#d4af37" : "#1a0033"}
                stroke="#d4af37"
                strokeWidth={1.5}
                {...(node.hidden ? { strokeDasharray: "4 3", opacity: 0.6 } : {})}
              />
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7.5}
                fill={isActive ? "#0a0015" : "#e6d5b8"}
                pointerEvents="none"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {node.name}
              </text>
            </g>
          );
        })}
      </svg>

      {active && (
        <div
          key={active.name}
          role="tooltip"
          id={`sephira-${active.name}`}
          className={`tree-popup ${popupSide(active)} z-10 p-4 border border-[#d4af37]/40 rounded-lg
                     bg-[#1a0033]/95 shadow-[0_0_30px_rgba(212,175,55,0.2)]`}
          style={popupStyle(active)}
        >
          <h3
            className="text-base sm:text-lg text-[#d4af37] tracking-wider mb-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            {active.name}
          </h3>
          <p
            className="text-[#e6d5b8]/90 text-sm sm:text-base leading-relaxed"
            style={{ fontFamily: "'Crimson Pro', serif" }}
          >
            {active.description}
          </p>
        </div>
      )}
    </div>
  );
};

export default TreeOfLifeDiagram;
