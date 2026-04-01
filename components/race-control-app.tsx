"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { LandingScreen } from "@/components/screens/landing-screen";
import { SetupScreen } from "@/components/screens/setup-screen";
import { DashboardScreen } from "@/components/screens/dashboard-screen";
import { DebriefScreen } from "@/components/screens/debrief-screen";
import { buildQualifyingReport, simulateSession } from "@/lib/simulation";
import type { QualifyingReport, Screen, SessionInput, SimulatedSession } from "@/lib/types";

const STORAGE_KEY = "night-out-race-control:last-session";

const DEFAULT_INPUT: SessionInput = {
  driverName: "Marvin",
  teamName: "Dorfnet GP",
  sessionType: "Unknown Conditions",
  trackName: "Paderborn Night Circuit",
  sleepLevel: 6,
  hungerLevel: 5,
  confidenceLevel: 7,
  socialBattery: 6,
  chaosIntent: 4,
  budgetTolerance: 5,
  hydration: 6,
  riskAppetite: 5,
};

export function RaceControlApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [input, setInput] = useState<SessionInput>(DEFAULT_INPUT);
  const [qualifying, setQualifying] = useState<QualifyingReport | null>(null);
  const [session, setSession] = useState<SimulatedSession | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(900);
  const [playbackLabel, setPlaybackLabel] = useState("Live feed");
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasPrevious(Boolean(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (!isPlaying || !session) return;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= session.frames.length - 1) {
          window.clearInterval(timer);
          setIsPlaying(false);
          persistSession(session);
          setHasPrevious(true);
          setScreen("debrief");
          return current;
        }
        return current + 1;
      });
    }, playbackSpeed);

    return () => window.clearInterval(timer);
  }, [isPlaying, playbackSpeed, session]);

  const currentFrame = useMemo(() => {
    if (!session) return null;
    return session.frames[Math.min(frameIndex, session.frames.length - 1)];
  }, [frameIndex, session]);

  const startSimulation = (speed: number, label: string) => {
    const nextSession = simulateSession(input);
    setSession(nextSession);
    setFrameIndex(0);
    setPlaybackSpeed(speed);
    setPlaybackLabel(label);
    setScreen("dashboard");
    setIsPlaying(true);
  };

  const handleLoadPrevious = () => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as SimulatedSession;
    setSession(parsed);
    setInput(parsed.input);
    setQualifying(parsed.qualifying);
    setFrameIndex(parsed.frames.length - 1);
    setIsPlaying(false);
    setPlaybackLabel("Geladene Session");
    setScreen("debrief");
  };

  const handleEnd = () => {
    if (!session) return;
    setIsPlaying(false);
    persistSession(session);
    setHasPrevious(true);
    setScreen("debrief");
  };

  const handleRestartReplay = () => {
    if (!session) return;
    setFrameIndex(0);
    setPlaybackSpeed(650);
    setPlaybackLabel("Replay Feed");
    setScreen("dashboard");
    setIsPlaying(true);
  };

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {screen === "landing" ? (
          <ScreenFrame key="landing">
            <LandingScreen onStart={() => setScreen("setup")} onLoadPrevious={handleLoadPrevious} hasPrevious={hasPrevious} />
          </ScreenFrame>
        ) : null}

        {screen === "setup" ? (
          <ScreenFrame key="setup">
            <SetupScreen
              value={input}
              onChange={(next) => {
                setInput(next);
                setQualifying(null);
              }}
              onBack={() => setScreen("landing")}
              onQualifying={() => setQualifying(buildQualifyingReport(input))}
              onStart={() => startSimulation(950, "Live Feed")}
              onFastSim={() => startSimulation(280, "Beschleunigte Simulation")}
              qualifying={qualifying}
            />
          </ScreenFrame>
        ) : null}

        {screen === "dashboard" && session && currentFrame ? (
          <ScreenFrame key="dashboard">
            <DashboardScreen
              session={session}
              frame={currentFrame}
              currentIndex={frameIndex}
              isPlaying={isPlaying}
              playbackLabel={playbackLabel}
              onTogglePlayback={() => setIsPlaying((value) => !value)}
              onAdvance={() => {
                setIsPlaying(false);
                setFrameIndex((current) => Math.min(current + 1, session.frames.length - 1));
              }}
              onEnd={handleEnd}
            />
          </ScreenFrame>
        ) : null}

        {screen === "debrief" && session ? (
          <ScreenFrame key="debrief">
            <DebriefScreen session={session} onRestart={handleRestartReplay} onNewSession={() => setScreen("setup")} />
          </ScreenFrame>
        ) : null}
      </AnimatePresence>
    </MotionConfig>
  );
}

function ScreenFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function persistSession(session: SimulatedSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
