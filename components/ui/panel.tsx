import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,30,0.96),rgba(8,10,18,0.98))] px-4 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-sm",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,132,255,0.08),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%)]" />
      {(eyebrow || title || action) && (
        <div className="relative mb-4 flex items-start justify-between gap-4 border-b border-white/8 pb-3">
          <div>
            {eyebrow ? <div className="mb-1 text-[10px] uppercase tracking-[0.32em] text-white/45">{eyebrow}</div> : null}
            {title ? <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-white/92">{title}</h3> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}
