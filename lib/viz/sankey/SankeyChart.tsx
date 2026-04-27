'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';
import type { SankeyFlow } from './buildFlows';
import { formatMoney } from '@/lib/utils';

type Node = { id: string; label: string };

export default function SankeyChart({
  nodes,
  links,
  currency,
}: {
  nodes: Node[];
  links: SankeyFlow[];
  currency: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]   = useState(800);
  const [height, setHeight] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
      setHeight(Math.max(360, entry.contentRect.height));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (nodes.length === 0 || links.length === 0) return null;
    const sankeyLayout = sankey<Node, SankeyFlow & { source: string | number; target: string | number }>()
      .nodeId((d: Node) => d.id)
      .nodeAlign(sankeyJustify)
      .nodeWidth(14)
      .nodePadding(12)
      .extent([[1, 1], [width - 1, height - 1]]);
    try {
      return sankeyLayout({
        nodes: nodes.map((n) => ({ ...n })),
        links: links.map((l) => ({ ...l })),
      });
    } catch {
      return null;
    }
  }, [nodes, links, width, height]);

  if (!layout || layout.nodes.length === 0) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center text-sm text-[color:var(--color-muted-foreground)]">
        Not enough flow data yet for a {currency} Sankey.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <svg width={width} height={height} className="block">
        <g>
          {layout.links.map((link, i) => (
            <path
              key={i}
              d={sankeyLinkHorizontal()(link as never) ?? undefined}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.18}
              strokeWidth={Math.max(1, link.width ?? 1)}
              className="text-indigo-500"
            >
              <title>
                {`${typeof link.source === 'object' ? (link.source as Node).label : link.source} → ${typeof link.target === 'object' ? (link.target as Node).label : link.target}: ${formatMoney(Math.round((link as { value?: number }).value ?? 0), currency)}`}
              </title>
            </path>
          ))}
        </g>
        <g>
          {layout.nodes.map((n) => (
            <g key={n.id}>
              <rect
                x={n.x0}
                y={n.y0}
                width={(n.x1 ?? 0) - (n.x0 ?? 0)}
                height={Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0))}
                className="fill-zinc-700 dark:fill-zinc-300"
              />
              <text
                x={(n.x0 ?? 0) < width / 2 ? (n.x1 ?? 0) + 6 : (n.x0 ?? 0) - 6}
                y={(((n.y0 ?? 0) + (n.y1 ?? 0)) / 2)}
                dy="0.35em"
                textAnchor={(n.x0 ?? 0) < width / 2 ? 'start' : 'end'}
                className="text-[10px] fill-current"
              >
                {n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
