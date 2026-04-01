"use client";

import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import type { SimulatedSession } from "@/lib/types";

export function DebriefScreen({
  session,
  onRestart,
  onNewSession,
}: {
  session: SimulatedSession;
  onRestart: () => void;
  onNewSession: () => void;
}) {
  const { debrief, input } = session;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(91,106,255,0.14),transparent_30%),linear-gradient(180deg,#03050a,#060914_42%,#04060d)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1460px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-white/[0.03] px-4 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.34em] text-white/42">Post-race debrief</div>
            <h1 className="mt-1 text-2xl font-semibold uppercase tracking-[0.12em] text-white sm:text-3xl">{input.driverName} · {input.teamName}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onRestart} className="border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] uppercase tracking-[0.32em] text-white transition hover:bg-white/[0.08]">
              Replay session
            </button>
            <button onClick={onNewSession} className="border border-white px-4 py-3 text-[10px] uppercase tracking-[0.32em] text-slate-950 transition hover:bg-white/90">
              New setup
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            <Panel eyebrow="Classification" title="Final result">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DebriefMetric label="Final classification" value={debrief.finalClassification} />
                <DebriefMetric label="Best lap" value={debrief.bestLap} />
                <DebriefMetric label="Weakest sector" value={debrief.weakestSector} />
                <DebriefMetric label="Incident count" value={String(debrief.incidentCount)} />
                <DebriefMetric label="Peak pace phase" value={debrief.peakPacePhase} />
                <DebriefMetric label="Tyre cliff" value={debrief.tyreCliffMoment} />
                <DebriefMetric label="Session type" value={input.sessionType} />
                <DebriefMetric label="Track" value={input.trackName} />
              </div>
            </Panel>

            <Panel eyebrow="Engineering verdict" title="Operational summary">
              <div className="grid gap-4 xl:grid-cols-2">
                <ReviewBlock label="Engineer verdict" text={debrief.engineerVerdict} />
                <ReviewBlock label="Steward notes" text={debrief.stewardNotes} />
                <ReviewBlock label="Missed pit window" text={debrief.missedPitWindow} />
                <ReviewBlock label="Suggested next strategy" text={debrief.suggestedStrategy} />
              </div>
            </Panel>

            <Panel eyebrow="Highlights" title="Session findings">
              <div className="space-y-3">
                {debrief.highlights.map((highlight, index) => (
                  <div key={highlight} className="flex gap-3 border border-white/8 bg-white/[0.03] px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.32em] text-white/32">0{index + 1}</div>
                    <div className="text-sm leading-7 text-white/72">{highlight}</div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel eyebrow="Session disposition" title="Official status">
              <div className="space-y-3">
                <StatusRow label="Behavioural consistency" status={debrief.incidentCount <= 1 ? "GREEN" : debrief.incidentCount <= 3 ? "YELLOW" : "RED"} text={debrief.incidentCount <= 1 ? "Acceptable" : debrief.incidentCount <= 3 ? "Review advised" : "Compromised"} />
                <StatusRow label="Resource management" status={debrief.missedPitWindow.startsWith("Yes") ? "ORANGE" : "GREEN"} text={debrief.missedPitWindow.startsWith("Yes") ? "Support window missed" : "Window respected"} />
                <StatusRow label="Late-session stability" status={debrief.tyreCliffMoment.startsWith("Lap") ? "YELLOW" : "GREEN"} text={debrief.tyreCliffMoment} />
              </div>
            </Panel>

            <Panel eyebrow="Driver baseline" title="Input declaration recap">
              <div className="grid grid-cols-2 gap-3">
                <InputMetric label="Sleep" value={input.sleepLevel} />
                <InputMetric label="Hunger" value={input.hungerLevel} />
                <InputMetric label="Confidence" value={input.confidenceLevel} />
                <InputMetric label="Social battery" value={input.socialBattery} />
                <InputMetric label="Chaos intent" value={input.chaosIntent} />
                <InputMetric label="Budget tolerance" value={input.budgetTolerance} />
                <InputMetric label="Hydration" value={input.hydration} />
                <InputMetric label="Risk appetite" value={input.riskAppetite} />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebriefMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.32em] text-white/42">{label}</div>
      <div className="text-lg font-medium uppercase tracking-[0.12em] text-white">{value}</div>
    </div>
  );
}

function ReviewBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.32em] text-white/42">{label}</div>
      <div className="text-sm leading-8 text-white/72">{text}</div>
    </div>
  );
}

function StatusRow({ label, status, text }: { label: string; status: "GREEN" | "YELLOW" | "ORANGE" | "RED"; text: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-white/8 bg-white/[0.03] p-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-white/42">{label}</div>
        <div className="mt-1 text-sm text-white/68">{text}</div>
      </div>
      <StatusPill value={status} />
    </div>
  );
}

function InputMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/42">{label}</div>
      <div className="text-3xl font-semibold text-white">{value}</div>
    </div>
  );
}
