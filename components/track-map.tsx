"use client";

import { motion } from "motion/react";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types";

const NODES = [
  { name: "Warm-Up Esses", x: 90, y: 88 },
  { name: "Kiosk Chicane", x: 182, y: 48 },
  { name: "Social Hairpin", x: 290, y: 82 },
  { name: "Regret Straight", x: 342, y: 176 },
  { name: "Döner Sector", x: 240, y: 246 },
  { name: "Re-entry Complex", x: 114, y: 214 },
] as const;

export function TrackMap({
  activeSegment,
  markers,
  trackName,
  flagState,
}: {
  activeSegment: string;
  markers: Array<{ segment: string; severity: Severity; label: string }>;
  trackName: string;
  flagState: string;
}) {
  const activeNode = NODES.find((node) => node.name === activeSegment) ?? NODES[0];
  const path = NODES.map((node, index) => `${index === 0 ? "M" : "L"}${node.x},${node.y}`).join(" ") + " Z";

  return (
    <Panel
      eyebrow="Track intelligence"
      title={trackName}
      action={<StatusPill value={flagState} />}
      className="min-h-[420px]"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_184px]">
        <div className="relative overflow-hidden border border-white/8 bg-[radial-gradient(circle_at_center,rgba(91,106,255,0.1),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] p-4">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:32px_32px] opacity-[0.18]" />
          <svg viewBox="0 0 430 300" className="relative z-10 h-[320px] w-full">
            <path d={path} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="26" strokeLinejoin="round" />
            <path d={path} fill="none" stroke="rgba(120,132,255,0.58)" strokeWidth="8" strokeLinejoin="round" />
            {NODES.map((node) => {
              const active = node.name === activeSegment;
              const marker = markers.find((item) => item.segment === node.name);
              return (
                <g key={node.name}>
                  <circle cx={node.x} cy={node.y} r={active ? 12 : 8} fill={active ? "rgba(255,255,255,0.95)" : "rgba(120,132,255,0.8)"} />
                  <circle cx={node.x} cy={node.y} r={active ? 26 : 18} fill="transparent" stroke={active ? "rgba(255,255,255,0.18)" : "rgba(120,132,255,0.16)"} />
                  {marker ? <circle cx={node.x + 16} cy={node.y - 16} r="5" fill={colorForSeverity(marker.severity)} /> : null}
                  <text x={node.x + 14} y={node.y + 5} fill="rgba(255,255,255,0.8)" fontSize="10" letterSpacing="2.4">
                    {node.name.toUpperCase()}
                  </text>
                </g>
              );
            })}
            <motion.g
              animate={{ x: activeNode.x, y: activeNode.y }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
            >
              <motion.circle
                cx="0"
                cy="0"
                r="16"
                fill="rgba(255,255,255,0.08)"
                animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.6, 0.2, 0.6] }}
                transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.8, ease: "easeInOut" }}
              />
              <circle cx="0" cy="0" r="6" fill="rgba(255,255,255,0.96)" />
            </motion.g>
          </svg>
        </div>
        <div className="space-y-3">
          <MapLabel title="Active segment" value={activeSegment} />
          <MapLabel title="Primary warning" value={markers[0]?.label ?? "None"} subdued={!markers[0]} />
          <MapLabel title="Trajectory" value={flagState === "RED" ? "Containment" : flagState === "SAFETY CAR" ? "Neutralised" : "Live push"} />
          <div className="border border-white/8 bg-white/[0.03] p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-white/42">Segment stack</div>
            <div className="space-y-2 text-sm text-white/75">
              {NODES.map((node, index) => (
                <div key={node.name} className={cn("flex items-center justify-between gap-3 border-b border-white/5 py-1 last:border-b-0", node.name === activeSegment && "text-white") }>
                  <span className="truncate">T{index + 1} · {node.name}</span>
                  <span className="text-white/42">{String(index + 1).padStart(2, "0")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function MapLabel({ title, value, subdued = false }: { title: string; value: string; subdued?: boolean }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/38">{title}</div>
      <div className={cn("text-sm uppercase tracking-[0.14em]", subdued ? "text-white/45" : "text-white/90")}>{value}</div>
    </div>
  );
}

function colorForSeverity(severity: Severity) {
  switch (severity) {
    case "GREEN":
      return "#34d399";
    case "YELLOW":
      return "#facc15";
    case "ORANGE":
      return "#fb923c";
    case "RED":
      return "#ef4444";
    case "PURPLE":
      return "#8b5cf6";
    default:
      return "#94a3b8";
  }
}
