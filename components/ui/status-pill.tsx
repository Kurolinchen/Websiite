import { cn } from "@/lib/utils";
import type { Severity, FlagState } from "@/lib/types";

const MAP: Record<Severity | FlagState, string> = {
  GREEN: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.18)]",
  YELLOW: "border-yellow-400/30 bg-yellow-400/10 text-yellow-100 shadow-[0_0_18px_rgba(250,204,21,0.14)]",
  ORANGE: "border-orange-400/30 bg-orange-400/10 text-orange-100 shadow-[0_0_18px_rgba(251,146,60,0.14)]",
  RED: "border-red-500/30 bg-red-500/10 text-red-100 shadow-[0_0_18px_rgba(239,68,68,0.16)]",
  PURPLE: "border-violet-400/30 bg-violet-400/10 text-violet-100 shadow-[0_0_18px_rgba(167,139,250,0.18)]",
  "SAFETY CAR": "border-sky-400/30 bg-sky-400/10 text-sky-100 shadow-[0_0_18px_rgba(56,189,248,0.16)]",
};

export function StatusPill({ value, className }: { value: Severity | FlagState | string; className?: string }) {
  const color = value in MAP ? MAP[value as keyof typeof MAP] : "border-white/10 bg-white/5 text-white/70";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em]",
        color,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}
