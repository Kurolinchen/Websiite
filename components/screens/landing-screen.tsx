"use client";

import { motion } from "motion/react";

export function LandingScreen({
  onStart,
  onLoadPrevious,
  hasPrevious,
}: {
  onStart: () => void;
  onLoadPrevious: () => void;
  hasPrevious: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(120,132,255,0.18),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.08),transparent_22%),linear-gradient(180deg,#03050a,#050814_55%,#04060d)]" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(255,255,255,0.04)_45%,transparent_100%)] opacity-40" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1460px] flex-col justify-between border border-white/10 bg-white/[0.02] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-10">
        <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.42em] text-white/45">Telemetry Suite</div>
            <div className="mt-1 text-sm uppercase tracking-[0.18em] text-white/72">Verhaltenstelemetrie · Strategische Aufsicht · Lokale Simulation</div>
          </div>
          <div className="hidden text-right text-[11px] uppercase tracking-[0.28em] text-white/40 sm:block">
            Control Room Build
            <div className="mt-1 text-white/70">NRC / Evening Conditions</div>
          </div>
        </div>

        <div className="grid items-end gap-10 py-10 xl:grid-cols-[minmax(0,1.1fr)_440px]">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-5 inline-flex items-center gap-3 border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.34em] text-white/55">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Session-Ready Monitoring Environment
              </div>
              <h1 className="max-w-5xl text-4xl font-semibold uppercase tracking-[0.12em] text-white sm:text-6xl xl:text-[6.4rem] xl:leading-[0.92]">
                Night Out
                <br />
                Race Control
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-white/68 sm:text-lg">
                Verhaltenstelemetrie und Strategieaufsicht für instabile Abendbedingungen.
                Entwickelt zur Bewertung von Pace, Sozialbatterie, Gesprächsübersteuern,
                Nahrungsfenstern und sauberem Heimkommen — mit völlig unnötiger Ernsthaftigkeit.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 flex flex-wrap gap-3"
            >
              <button
                onClick={onStart}
                className="border border-white/10 bg-white px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-slate-950 transition hover:-translate-y-0.5 hover:bg-white/90"
              >
                Session Starten
              </button>
              <button
                onClick={onLoadPrevious}
                disabled={!hasPrevious}
                className="border border-white/12 bg-white/[0.04] px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-white transition hover:-translate-y-0.5 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Vorige Session Laden
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.24, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-4"
          >
            <HeroCard title="Live-Aufsicht" value="18 Laps" detail="Mehrphasige Session mit Incident-Modell, Pit-Window-Logik und kontrollierten Eskalationspfaden." />
            <HeroCard title="Streckenlayout" value="6 Segmente" detail="Warm-Up Esses, Kiosk Chicane, Social Hairpin, Regret Straight, Döner Sector und Re-entry Complex." />
            <HeroCard title="Strategy Desk" value="Realtime" detail="Trockene Ingenieurs-Copy, Incident Feed, Team Radio, Debrief und lokale Session-Historie." />
          </motion.div>
        </div>

        <div className="grid gap-3 border-t border-white/8 pt-4 text-[11px] uppercase tracking-[0.26em] text-white/42 sm:grid-cols-3">
          <div>Flag States · Green · Yellow · Safety Car · Red · Purple</div>
          <div>Pace · Degradation · Decision Quality · Social Grip</div>
          <div>Kein Backend erforderlich · Lokaler Sessionspeicher im Browser</div>
        </div>
      </div>
    </div>
  );
}

function HeroCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-5">
      <div className="mb-2 text-[10px] uppercase tracking-[0.34em] text-white/42">{title}</div>
      <div className="mb-3 text-3xl font-semibold uppercase tracking-[0.08em] text-white">{value}</div>
      <p className="text-sm leading-7 text-white/62">{detail}</p>
    </div>
  );
}
