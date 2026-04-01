"use client";

import { MetricCard } from "@/components/ui/metric-card";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import { TelemetryChart } from "@/components/charts/telemetry-chart";
import { TrackMap } from "@/components/track-map";
import { minutesToDuration } from "@/lib/utils";
import type { Phase, SimulatedSession, TelemetryFrame } from "@/lib/types";

export function DashboardScreen({
  session,
  frame,
  currentIndex,
  isPlaying,
  playbackLabel,
  onTogglePlayback,
  onAdvance,
  onEnd,
}: {
  session: SimulatedSession;
  frame: TelemetryFrame;
  currentIndex: number;
  isPlaying: boolean;
  playbackLabel: string;
  onTogglePlayback: () => void;
  onAdvance: () => void;
  onEnd: () => void;
}) {
  const history = session.frames.slice(0, currentIndex + 1);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(91,106,255,0.14),transparent_30%),linear-gradient(180deg,#03040a,#060914_42%,#04060d)] px-3 py-3 sm:px-4 lg:px-5">
      <div className="mx-auto flex max-w-[1680px] flex-col gap-3">
        <TopBar session={session} frame={frame} playbackLabel={playbackLabel} isPlaying={isPlaying} onTogglePlayback={onTogglePlayback} onAdvance={onAdvance} onEnd={onEnd} />

        <div className="grid gap-3 2xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <div className="space-y-3">
            <Panel eyebrow="Classification" title="Kontrollmetriken" className="min-h-[468px]">
              <div className="space-y-2">
                {frame.classification.map((metric) => (
                  <div key={metric.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border border-white/8 bg-white/[0.03] px-3 py-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.28em] text-white/42">{metric.label}</div>
                      <div className="mt-1 text-lg font-medium tracking-[0.08em] text-white">{metric.value}</div>
                    </div>
                    <Trend trend={metric.trend} />
                    <StatusPill value={metric.severity} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Sector Delta" title="Sektor-Analyse">
              <div className="grid grid-cols-3 gap-3">
                <SectorCard label="Sector 1" value={frame.sectorScores.s1} />
                <SectorCard label="Sector 2" value={frame.sectorScores.s2} />
                <SectorCard label="Sector 3" value={frame.sectorScores.s3} />
              </div>
              <div className="mt-4 grid gap-3 text-sm uppercase tracking-[0.18em] text-white/70">
                <div className="flex items-center justify-between border border-white/8 bg-white/[0.03] px-3 py-3">
                  <span>Stärkster Sektor</span>
                  <span className="text-white">{frame.sectorScores.strongest}</span>
                </div>
                <div className="flex items-center justify-between border border-white/8 bg-white/[0.03] px-3 py-3">
                  <span>Schwächster Sektor</span>
                  <span className="text-white">{frame.sectorScores.weakest}</span>
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-3">
            <TrackMap activeSegment={frame.activeSegment} markers={frame.markers} trackName={session.input.trackName} flagState={frame.flagState} />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                label="Pace Delta"
                value={frame.paceDelta}
                digits={1}
                suffix="s"
                severity={frame.classification.find((item) => item.key === "delta")?.severity ?? "GREEN"}
                hint="Abweichung von der erklärten Normalform. Negativ bleibt gesünder."
              />
              <MetricCard
                label="Tyre Degradation"
                value={frame.tyreDeg}
                suffix="%"
                severity={frame.classification.find((item) => item.key === "tyre")?.severity ?? "GREEN"}
                hint="Abbildung sinkender Sozialbatterie und sichtbar nachlassender Geduld."
              />
              <MetricCard
                label="Fuel State"
                value={frame.fuelState}
                suffix="%"
                severity={frame.classification.find((item) => item.key === "fuel")?.severity ?? "GREEN"}
                hint="Kombiniert Kalorienlage, Stabilität und Restbereitschaft zum sauberen Ende."
              />
              <MetricCard
                label="ERS Reserve"
                value={frame.ersReserve}
                suffix="%"
                severity={frame.classification.find((item) => item.key === "ers")?.severity ?? "GREEN"}
                hint="Kurzfristiger Charisma-Boost und Reserve für ungeplante Rettungsmanöver."
              />
              <MetricCard
                label="Decision Quality"
                value={frame.decisionQuality}
                suffix="%"
                severity={frame.classification.find((item) => item.key === "decision")?.severity ?? "GREEN"}
                hint="Wie viel des aktuellen Selbstvertrauens durch Beweislage gedeckt ist."
              />
              <MetricCard
                label="Track Limits Exposure"
                value={frame.trackLimitsExposure}
                suffix="%"
                severity={frame.trackLimitsExposure > 80 ? "RED" : frame.trackLimitsExposure > 62 ? "YELLOW" : "GREEN"}
                hint="Wahrscheinlichkeit, zu früh, zu viel und mit zu wenig Bremsweg zu sagen."
              />
            </div>

            <div className="grid gap-3 xl:grid-cols-2">
              <TelemetryChart title="Pace über die Laps" eyebrow="Performance Trace" values={history.map((item) => item.paceIndex)} currentIndex={history.length - 1} />
              <TelemetryChart title="Degradation der Sozialbatterie" eyebrow="Wear Model" values={history.map((item) => item.tyreDeg)} currentIndex={history.length - 1} formatter={(value) => `${value.toFixed(0)}%`} />
              <TelemetryChart title="Verlauf der Entscheidungsqualität" eyebrow="Judgement Model" values={history.map((item) => item.decisionQuality)} currentIndex={history.length - 1} formatter={(value) => `${value.toFixed(0)}%`} />
              <TelemetryChart title="Incident-Wahrscheinlichkeit" eyebrow="Steward Exposure" values={history.map((item) => item.incidentRisk)} currentIndex={history.length - 1} formatter={(value) => `${value.toFixed(0)}%`} />
            </div>
          </div>

          <div className="space-y-3">
            <Panel eyebrow="Live Feed" title="Incident Register" className="min-h-[360px]">
              <div className="space-y-2">
                {frame.feed.slice(-10).reverse().map((item) => (
                  <div key={item.id} className="border border-white/8 bg-white/[0.03] px-3 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-white/40">
                      <span>{item.timestamp}</span>
                      <StatusPill value={item.severity} />
                    </div>
                    <div className="text-sm leading-7 text-white/72">{item.message}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Strategy Desk" title="Empfohlene Maßnahmen">
              <div className="space-y-3">
                {frame.strategyNotes.map((note) => (
                  <div key={note.id} className="border border-white/8 bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-white/42">{note.label}</div>
                      <StatusPill value={note.severity} />
                    </div>
                    <div className="text-sm leading-7 text-white/70">{note.detail}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="Comms" title="Team Radio">
              <div className="space-y-3">
                {frame.radio.map((call) => (
                  <div key={call.id} className="border border-white/8 bg-[#070b14] p-3">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/42">{call.who}</div>
                    <div className="font-mono text-sm uppercase tracking-[0.16em] text-white/88">“{call.message}”</div>
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-2 pt-1 text-[10px] uppercase tracking-[0.24em] text-white/60">
                  {[
                    "Copy.",
                    "Box, box.",
                    "Pace fällt.",
                    "Keine Heldentaten.",
                  ].map((label) => (
                    <button key={label} className="border border-white/8 bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/[0.06]">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({
  session,
  frame,
  playbackLabel,
  isPlaying,
  onTogglePlayback,
  onAdvance,
  onEnd,
}: {
  session: SimulatedSession;
  frame: TelemetryFrame;
  playbackLabel: string;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onAdvance: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="grid gap-3 border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))] px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-white/58">
        <StatusPill value={frame.flagState} />
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">Lap {String(frame.lap).padStart(2, "0")}/{String(frame.totalLaps).padStart(2, "0")}</span>
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">Restzeit {minutesToDuration(frame.remainingMinutes)}</span>
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">{frame.conditionLabel}</span>
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">{frame.trackCondition}</span>
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">Phase: {phaseLabel(frame.phase)}</span>
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">Driver: {session.input.driverName}</span>
        <span className="border border-white/8 bg-white/[0.03] px-3 py-2">Team: {session.input.teamName}</span>
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
        <div className="mr-2 text-[10px] uppercase tracking-[0.3em] text-white/42">{playbackLabel}</div>
        <button onClick={onTogglePlayback} className="border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-white transition hover:bg-white/[0.08]">
          {isPlaying ? "Feed pausieren" : "Feed fortsetzen"}
        </button>
        <button onClick={onAdvance} className="border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-white transition hover:bg-white/[0.08]">
          Nächste Lap
        </button>
        <button onClick={onEnd} className="border border-white px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-slate-950 transition hover:bg-white/90">
          Debrief
        </button>
      </div>
    </div>
  );
}

function phaseLabel(phase: Phase) {
  switch (phase) {
    case "Warm-up":
      return "Warm-up";
    case "Build Phase":
      return "Aufbauphase";
    case "Mid-Stint":
      return "Mid-Stint";
    case "Stabilisation":
      return "Stabilisierung";
    case "Damage Limitation":
      return "Damage Limitation";
    case "Final Push":
      return "Final Push";
    default:
      return phase;
  }
}

function Trend({ trend }: { trend: -1 | 0 | 1 }) {
  return (
    <div className="text-sm text-white/60">
      {trend === 1 ? "▲" : trend === -1 ? "▼" : "•"}
    </div>
  );
}

function SectorCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/38">{label}</div>
      <div className="text-3xl font-semibold text-white">{Math.round(value)}</div>
    </div>
  );
}
