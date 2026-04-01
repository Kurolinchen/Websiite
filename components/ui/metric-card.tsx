import { AnimatedNumber } from "@/components/ui/animated-number";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/types";

export function MetricCard({
  label,
  value,
  suffix,
  prefix,
  digits,
  severity,
  hint,
  compact = false,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  digits?: number;
  severity: Severity;
  hint: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative border border-white/10 bg-white/[0.025] p-4 transition-transform duration-300 hover:-translate-y-0.5",
        compact ? "min-h-[128px]" : "min-h-[156px]",
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.34em] text-white/45">{label}</div>
        <StatusPill value={severity} />
      </div>
      <div className="mb-3 text-3xl font-semibold leading-none tracking-tight text-white sm:text-[2.25rem]">
        <AnimatedNumber value={value} suffix={suffix} prefix={prefix} digits={digits} />
      </div>
      <div className="max-w-[24ch] text-sm leading-6 text-white/62">{hint}</div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
    </div>
  );
}
