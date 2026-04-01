"use client";

import type { ReactNode } from "react";
import { Panel } from "@/components/ui/panel";
import { StatusPill } from "@/components/ui/status-pill";
import type { QualifyingReport, SessionInput, SessionType } from "@/lib/types";

const SESSION_TYPES: SessionType[] = [
  "Casual Run",
  "Full Send",
  "Damage Limitation",
  "Recovery Drive",
  "Unknown Conditions",
];

const TRACKS = [
  "Inner City Circuit",
  "Kiosk Loop",
  "Late Night Ring",
  "Downtown Street Course",
  "Paderborn Night Circuit",
];

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  "Casual Run": "Casual Run",
  "Full Send": "Full Send",
  "Damage Limitation": "Damage Limitation",
  "Recovery Drive": "Recovery Drive",
  "Unknown Conditions": "Unknown Conditions",
};

const SLIDERS: Array<{ key: keyof SessionInput; label: string; description: string }> = [
  { key: "sleepLevel", label: "Schlaflevel", description: "Grundstabilität vor Freigabe der Session." },
  { key: "hungerLevel", label: "Hungerlevel", description: "Wie früh das Fuel-Modell unfreundlich wird." },
  { key: "confidenceLevel", label: "Selbstvertrauen", description: "Potentielle Pace, aber auch potentieller Unsinn." },
  { key: "socialBattery", label: "Sozialbatterie", description: "Wie lange die Reifen kooperativ bleiben." },
  { key: "chaosIntent", label: "Chaos-Intent", description: "Erklärte Bereitschaft zu fragwürdigen Entscheidungen." },
  { key: "budgetTolerance", label: "Budget-Toleranz", description: "Operative Freiheit für Support-Stopps." },
  { key: "hydration", label: "Hydration", description: "Spätstint-Stabilität und Restvernunft." },
  { key: "riskAppetite", label: "Risikoneigung", description: "Wie aggressiv sich Fenster angegriffen anfühlen." },
];

export function SetupScreen({
  value,
  onChange,
  onBack,
  onQualifying,
  onStart,
  onFastSim,
  qualifying,
}: {
  value: SessionInput;
  onChange: (next: SessionInput) => void;
  onBack: () => void;
  onQualifying: () => void;
  onStart: () => void;
  onFastSim: () => void;
  qualifying: QualifyingReport | null;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(91,106,255,0.14),transparent_30%),linear-gradient(180deg,#04060b,#060914_45%,#04060c)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1460px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.34em] text-white/42">Pre-Race Setup</div>
            <div className="mt-1 text-sm uppercase tracking-[0.14em] text-white/84">Fahrerdeklaration und Baseline-Kalibrierung</div>
          </div>
          <button onClick={onBack} className="border border-white/10 px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-white/68 transition hover:bg-white/[0.05]">
            Zurück zum Start
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_430px]">
          <div className="space-y-5">
            <Panel eyebrow="Identität" title="Session-Deklaration">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Driver Name">
                  <input value={value.driverName} onChange={(e) => onChange({ ...value, driverName: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Team Name">
                  <input value={value.teamName} onChange={(e) => onChange({ ...value, teamName: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Session Type">
                  <select value={value.sessionType} onChange={(e) => onChange({ ...value, sessionType: e.target.value as SessionType })} className={inputClass}>
                    {SESSION_TYPES.map((type) => (
                      <option key={type} value={type}>{SESSION_TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Track Name">
                  <div className="space-y-3">
                    <select value={TRACKS.includes(value.trackName) ? value.trackName : "Custom"} onChange={(e) => onChange({ ...value, trackName: e.target.value === "Custom" ? value.trackName : e.target.value })} className={inputClass}>
                      {TRACKS.map((track) => (
                        <option key={track}>{track}</option>
                      ))}
                      <option>Custom</option>
                    </select>
                    <input value={value.trackName} onChange={(e) => onChange({ ...value, trackName: e.target.value })} className={inputClass} />
                  </div>
                </Field>
              </div>
            </Panel>

            <Panel eyebrow="Fahrermodell" title="Performance- und Degradationsparameter">
              <div className="grid gap-4 lg:grid-cols-2">
                {SLIDERS.map((slider) => (
                  <div key={slider.key} className="border border-white/8 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.3em] text-white/42">{slider.label}</div>
                        <div className="mt-1 text-sm text-white/62">{slider.description}</div>
                      </div>
                      <div className="text-2xl font-semibold text-white">{value[slider.key] as number}</div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={value[slider.key] as number}
                      onChange={(e) => onChange({ ...value, [slider.key]: Number(e.target.value) })}
                      className="h-2 w-full appearance-none bg-white/10 accent-white"
                    />
                    <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.2em] text-white/32">
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-5">
            <Panel eyebrow="Control Summary" title="Erwartetes Betriebsfenster">
              <div className="grid gap-3">
                <SummaryRow label="Driver" value={value.driverName} />
                <SummaryRow label="Team" value={value.teamName} />
                <SummaryRow label="Track" value={value.trackName} />
                <SummaryRow label="Declared Mode" value={SESSION_TYPE_LABELS[value.sessionType]} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MiniMetric label="Stabilität" value={score(value.sleepLevel, value.hydration, value.socialBattery)} />
                <MiniMetric label="Volatilität" value={score(value.chaosIntent, value.riskAppetite, value.confidenceLevel)} danger />
                <MiniMetric label="Support-Bedarf" value={score(value.hungerLevel, 10 - value.hydration, 10 - value.budgetTolerance)} danger />
                <MiniMetric label="Opening Pace" value={score(value.confidenceLevel, value.socialBattery, value.sleepLevel)} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <StatusPill value={score(value.sleepLevel, value.socialBattery, value.hydration) > 72 ? "GREEN" : "YELLOW"} />
                <StatusPill value={value.chaosIntent > 7 ? "ORANGE" : "GREEN"} />
                <StatusPill value={value.hungerLevel > 7 ? "YELLOW" : "PURPLE"} />
              </div>
            </Panel>

            <Panel eyebrow="Aktionen" title="Simulationsbefehle">
              <div className="grid gap-3">
                <button onClick={onQualifying} className={primaryButtonClass}>
                  Qualifying-Simulation
                </button>
                <button onClick={onStart} className={secondaryButtonClass}>
                  Race Control Starten
                </button>
                <button onClick={onFastSim} className={secondaryButtonClass}>
                  Volle Rennsimulation
                </button>
              </div>
            </Panel>

            <Panel eyebrow="Qualifying Preview" title="Freigabebericht">
              {qualifying ? (
                <div className="space-y-4">
                  <div className="text-4xl font-semibold uppercase tracking-[0.08em] text-white">{qualifying.projectedGrid}</div>
                  <PreviewBlock label="Erwartete Eröffnungsphase" text={qualifying.expectedOpening} />
                  <PreviewBlock label="Start-Risiko" text={qualifying.startingRisk} />
                  <PreviewBlock label="Erwartetes Pit Window" text={qualifying.predictedPitWindow} />
                  <div className="border border-white/8 bg-white/[0.03] p-3">
                    <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/42">Engineer Notes</div>
                    <ul className="space-y-2 text-sm leading-7 text-white/64">
                      {qualifying.notes.map((note) => (
                        <li key={note}>— {note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-sm leading-7 text-white/54">
                  Starte eine Qualifying-Simulation, um eine unangemessen ernsthafte Prognose für den Verlauf des Abends zu erzeugen.
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/42">{label}</div>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/6 py-2 text-sm last:border-b-0">
      <span className="uppercase tracking-[0.24em] text-white/42">{label}</span>
      <span className="text-right uppercase tracking-[0.12em] text-white/88">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.28em] text-white/42">{label}</div>
      <div className={`text-3xl font-semibold ${danger ? "text-orange-100" : "text-white"}`}>{Math.round(value)}</div>
    </div>
  );
}

function PreviewBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="border border-white/8 bg-white/[0.03] p-3">
      <div className="mb-1 text-[10px] uppercase tracking-[0.3em] text-white/42">{label}</div>
      <div className="text-sm leading-7 text-white/70">{text}</div>
    </div>
  );
}

function score(a: number, b: number, c: number) {
  return ((a + b + c) / 30) * 100;
}

const inputClass =
  "w-full border border-white/10 bg-[#080b13] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/25";
const primaryButtonClass =
  "border border-white/10 bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-slate-950 transition hover:-translate-y-0.5 hover:bg-white/92";
const secondaryButtonClass =
  "border border-white/10 bg-white/[0.04] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.34em] text-white transition hover:-translate-y-0.5 hover:bg-white/[0.07]";
