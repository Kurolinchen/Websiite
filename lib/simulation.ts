import {
  average,
  clamp,
  createId,
  deltaSeverity,
  formatPercent,
  formatSigned,
  minutesToClock,
  mulberry32,
  round,
  scoreSeverity,
  seedFromString,
} from "@/lib/utils";
import type {
  ClassificationMetric,
  Debrief,
  FeedItem,
  FlagState,
  Phase,
  QualifyingReport,
  RadioCall,
  SessionInput,
  Severity,
  SimulatedSession,
  StrategyNote,
  TelemetryFrame,
} from "@/lib/types";

const TRACK_SEGMENTS = [
  "Warm-Up Esses",
  "Kiosk Chicane",
  "Social Hairpin",
  "Regret Straight",
  "Döner Sector",
  "Re-entry Complex",
] as const;

const SESSION_LAPS: Record<SessionInput["sessionType"], number> = {
  "Casual Run": 14,
  "Full Send": 18,
  "Damage Limitation": 16,
  "Recovery Drive": 12,
  "Unknown Conditions": 17,
};

function choosePhase(lap: number, totalLaps: number): Phase {
  const ratio = lap / totalLaps;
  if (ratio <= 0.18) return "Warm-up";
  if (ratio <= 0.38) return "Build Phase";
  if (ratio <= 0.64) return "Mid-Stint";
  if (ratio <= 0.8) return "Stabilisation";
  if (ratio <= 0.92) return "Damage Limitation";
  return "Final Push";
}

function chooseTrackCondition(
  incidentRisk: number,
  decisionQuality: number,
  socialGrip: number,
  flagState: FlagState,
) {
  if (flagState === "RED") return "session integrity compromised";
  if (flagState === "SAFETY CAR") return "neutralised social traffic";
  if (incidentRisk > 72) return "low-grip social conditions";
  if (decisionQuality < 45) return "degraded judgement surface";
  if (socialGrip > 78) return "stable flow window";
  return "mixed traction across key sectors";
}

function chooseConditionLabel(
  paceIndex: number,
  incidentRisk: number,
  tyreDeg: number,
  fuelState: number,
  flagState: FlagState,
) {
  if (flagState === "RED") return "Containment Protocol";
  if (flagState === "SAFETY CAR") return "Stabilisation Phase";
  if (paceIndex > 86 && incidentRisk < 32) return "Controlled Advantage";
  if (fuelState < 24 || tyreDeg > 72) return "Supportive Measures Required";
  if (incidentRisk > 68) return "Oversteer In Conversation";
  return "Operationally Acceptable";
}

function strategyFromState(args: {
  fuelState: number;
  tyreDeg: number;
  decisionQuality: number;
  incidentRisk: number;
  kebabWindow: number;
  hydration: number;
  phase: Phase;
}): StrategyNote[] {
  const notes: StrategyNote[] = [];

  if (args.kebabWindow >= 70) {
    notes.push({
      id: "food",
      label: "Box this lap",
      detail: "Nutrition window is open. Delaying service will not improve the tyre picture.",
      severity: args.fuelState < 30 ? "ORANGE" : "YELLOW",
    });
  }

  if (args.incidentRisk >= 72) {
    notes.push({
      id: "heroics",
      label: "No heroics",
      detail: "Avoid speculative conversational moves until stability returns.",
      severity: "RED",
    });
  }

  if (args.tyreDeg >= 64) {
    notes.push({
      id: "manage",
      label: "Manage the stint",
      detail: "Social battery is no longer happy. Reduce load and shorten engagements.",
      severity: "ORANGE",
    });
  }

  if (args.hydration <= 3) {
    notes.push({
      id: "hydrate",
      label: "Hydrate before next push",
      detail: "Available evidence does not support another attacking lap on current fluids.",
      severity: "YELLOW",
    });
  }

  if (args.decisionQuality >= 70 && args.incidentRisk < 45 && notes.length < 3) {
    notes.push({
      id: "stay-out",
      label: "Stay out",
      detail: "Current condition remains manageable. Maintain rhythm and protect position.",
      severity: "GREEN",
    });
  }

  if (args.phase === "Damage Limitation" && notes.length < 3) {
    notes.push({
      id: "damage",
      label: "Switch mode",
      detail: "Prioritise a clean finish over late-session reputation building.",
      severity: "YELLOW",
    });
  }

  return notes.slice(0, 3);
}

function radioFromState(args: {
  flagState: FlagState;
  incidentRisk: number;
  tyreDeg: number;
  fuelState: number;
  decisionQuality: number;
  lap: number;
}): RadioCall[] {
  const calls: RadioCall[] = [{ id: `eng-${args.lap}`, who: "ENGINEER", message: "Copy." }];

  if (args.flagState === "SAFETY CAR") {
    calls.push({ id: `rc-${args.lap}`, who: "CONTROL", message: "Safety car. Neutralise and reset." });
  } else if (args.flagState === "RED") {
    calls.push({ id: `rc-${args.lap}`, who: "CONTROL", message: "Red flag. Further heroics suspended." });
  } else if (args.fuelState < 28) {
    calls.push({ id: `engb-${args.lap}`, who: "ENGINEER", message: "Box, box. Fuel model no longer looks kind." });
  } else if (args.tyreDeg > 68) {
    calls.push({ id: `engt-${args.lap}`, who: "ENGINEER", message: "Tyres are gone. Manage the exits." });
  } else if (args.incidentRisk > 66) {
    calls.push({ id: `engi-${args.lap}`, who: "ENGINEER", message: "Pace is acceptable. Risk is not." });
  } else if (args.decisionQuality > 78) {
    calls.push({ id: `engg-${args.lap}`, who: "ENGINEER", message: "Window is open. Use it without improvising." });
  } else {
    calls.push({ id: `engd-${args.lap}`, who: "ENGINEER", message: "We are checking." });
  }

  return calls.slice(0, 2);
}

function metricsForFrame(frame: Omit<TelemetryFrame, "classification">, previous?: TelemetryFrame): ClassificationMetric[] {
  const buildTrend = (value: number, prev?: number, reverse = false): -1 | 0 | 1 => {
    if (prev === undefined) return 0;
    const improved = reverse ? value < prev : value > prev;
    if (Math.abs(value - prev) < 1.2) return 0;
    return improved ? 1 : -1;
  };

  return [
    {
      key: "pace",
      label: "PACE",
      value: `${Math.round(frame.paceIndex)}`,
      numericValue: frame.paceIndex,
      trend: buildTrend(frame.paceIndex, previous?.paceIndex),
      severity: scoreSeverity(frame.paceIndex),
    },
    {
      key: "delta",
      label: "DELTA",
      value: `${formatSigned(frame.paceDelta, 1)}s`,
      numericValue: frame.paceDelta,
      trend: buildTrend(frame.paceDelta, previous?.paceDelta, true),
      severity: deltaSeverity(frame.paceDelta),
    },
    {
      key: "tyre",
      label: "TYRE DEG",
      value: formatPercent(frame.tyreDeg),
      numericValue: frame.tyreDeg,
      trend: buildTrend(frame.tyreDeg, previous?.tyreDeg, true),
      severity: scoreSeverity(frame.tyreDeg, true),
    },
    {
      key: "fuel",
      label: "FUEL STATE",
      value: formatPercent(frame.fuelState),
      numericValue: frame.fuelState,
      trend: buildTrend(frame.fuelState, previous?.fuelState),
      severity: scoreSeverity(frame.fuelState),
    },
    {
      key: "ers",
      label: "ERS",
      value: formatPercent(frame.ersReserve),
      numericValue: frame.ersReserve,
      trend: buildTrend(frame.ersReserve, previous?.ersReserve),
      severity: scoreSeverity(frame.ersReserve),
    },
    {
      key: "incident",
      label: "INCIDENT RISK",
      value: formatPercent(frame.incidentRisk),
      numericValue: frame.incidentRisk,
      trend: buildTrend(frame.incidentRisk, previous?.incidentRisk, true),
      severity: scoreSeverity(frame.incidentRisk, true),
    },
    {
      key: "decision",
      label: "DECISION QUALITY",
      value: formatPercent(frame.decisionQuality),
      numericValue: frame.decisionQuality,
      trend: buildTrend(frame.decisionQuality, previous?.decisionQuality),
      severity: scoreSeverity(frame.decisionQuality),
    },
    {
      key: "social",
      label: "SOCIAL GRIP",
      value: formatPercent(frame.socialGrip),
      numericValue: frame.socialGrip,
      trend: buildTrend(frame.socialGrip, previous?.socialGrip),
      severity: scoreSeverity(frame.socialGrip),
    },
    {
      key: "kebab",
      label: "KEBAB WINDOW",
      value: formatPercent(frame.kebabWindow),
      numericValue: frame.kebabWindow,
      trend: buildTrend(frame.kebabWindow, previous?.kebabWindow),
      severity: scoreSeverity(frame.kebabWindow),
    },
  ];
}

export function buildQualifyingReport(input: SessionInput): QualifyingReport {
  const composite =
    input.sleepLevel * 1.9 +
    input.socialBattery * 1.7 +
    input.confidenceLevel * 1.4 +
    input.hydration * 1.1 -
    input.hungerLevel * 1.4 -
    input.chaosIntent * 0.9;

  const projectedPosition = clamp(Math.round(10 - composite / 6), 2, 11);
  const opening =
    input.chaosIntent >= 7
      ? "Opening pace looks ambitious. Containment capacity does not fully agree."
      : input.confidenceLevel >= 7
        ? "Strong launch likely, provided appetite is managed before the middle stint."
        : "Steady opening expected. Respectable if the driver avoids forcing the issue.";

  const risk =
    input.hydration <= 3
      ? "Hydration deficit likely to distort the late-race picture."
      : input.hungerLevel >= 7
        ? "Nutrition exposure will arrive earlier than the driver currently believes."
        : "Primary risk remains conversational overreach under improving conditions.";

  const pitWindow = clamp(Math.round(5 + (input.hungerLevel - input.budgetTolerance) / 2), 4, 10);

  return {
    projectedGrid: `P${projectedPosition} / 12`,
    expectedOpening: opening,
    startingRisk: risk,
    predictedPitWindow: `Lap ${pitWindow}–${pitWindow + 1}`,
    notes: [
      input.riskAppetite >= 7
        ? "Aggression is available, but evidence for control remains incomplete."
        : "Conservative calls should still produce a credible result.",
      input.sleepLevel <= 4
        ? "Early pace may flatter the true condition of the driver."
        : "Base operating temperature appears acceptable on release.",
      input.budgetTolerance <= 3
        ? "Food strategy is financially exposed. Missing the window is plausible."
        : "Support-stop budget is sufficient for corrective action if required.",
    ],
  };
}

export function simulateSession(input: SessionInput): SimulatedSession {
  const seed = seedFromString(`${input.driverName}|${input.teamName}|${input.trackName}|${input.sessionType}`)();
  const random = mulberry32(seed);
  const totalLaps = SESSION_LAPS[input.sessionType];
  const sessionId = `${seed.toString(16)}-${Date.now().toString(36)}`;
  const startedAtMinutes = 20 * 60 + 12 + Math.round(random() * 11);

  const qualifying = buildQualifyingReport(input);
  const frames: TelemetryFrame[] = [];
  const feed: FeedItem[] = [];

  const supportStopPlannedLap = clamp(
    Math.round(5 + input.hungerLevel * 0.45 - input.budgetTolerance * 0.2 + input.sleepLevel * 0.1),
    4,
    totalLaps - 3,
  );
  const supportStopLap =
    input.budgetTolerance <= 2 && input.chaosIntent >= 7
      ? null
      : clamp(supportStopPlannedLap + (random() > 0.65 ? 1 : 0), 4, totalLaps - 2);

  const safetyCarLap =
    random() < 0.62 ? clamp(Math.round(totalLaps * (0.45 + random() * 0.15)), 6, totalLaps - 4) : null;
  const incidentLap = clamp(Math.round(totalLaps * (0.55 + random() * 0.24)), 7, totalLaps - 1);
  const recoveryLap = clamp(Math.round(totalLaps * (0.72 + random() * 0.12)), 9, totalLaps);

  let elapsedMinutes = 0;
  let incidentCount = 0;
  let fuelState = clamp(92 - input.hungerLevel * 4.8 - (10 - input.hydration) * 1.1, 34, 96);
  let tyreDeg = clamp(6 + (10 - input.socialBattery) * 1.9 + (10 - input.sleepLevel) * 1.2, 4, 28);
  let ersReserve = clamp(32 + input.confidenceLevel * 5.4 + input.socialBattery * 1.8 - input.hungerLevel * 1.7, 16, 98);
  let decisionQuality = clamp(
    58 + input.sleepLevel * 2.5 + input.hydration * 2.1 + input.socialBattery * 1.4 - input.chaosIntent * 1.9 - input.hungerLevel * 1.7,
    28,
    94,
  );
  let socialGrip = clamp(
    54 + input.socialBattery * 3 + input.confidenceLevel * 1.5 - input.hungerLevel * 0.9 - input.chaosIntent * 0.8,
    30,
    96,
  );
  let incidentRisk = clamp(
    12 + input.chaosIntent * 4.1 + input.riskAppetite * 2.6 + Math.max(0, input.confidenceLevel - 7) * 1.8 - input.socialBattery * 1.5,
    8,
    88,
  );
  let trackLimitsExposure = clamp(
    14 + input.confidenceLevel * 4.8 + input.chaosIntent * 3.6 + input.riskAppetite * 2.2,
    18,
    90,
  );

  const pushFeed = (lap: number, severity: Severity, message: string) => {
    feed.push({
      id: createId("feed", feed.length + 1),
      lap,
      severity,
      timestamp: minutesToClock(startedAtMinutes + elapsedMinutes),
      message,
    });
    if (severity === "RED" || severity === "ORANGE" || severity === "YELLOW") {
      incidentCount += severity === "YELLOW" ? 0 : 1;
    }
  };

  pushFeed(0, "GREEN", `Session released to ${input.trackName}. Baseline confidence model online.`);

  for (let lap = 1; lap <= totalLaps; lap += 1) {
    const phase = choosePhase(lap, totalLaps);
    const phaseFactor = lap / totalLaps;
    const lapMinutes = 12 + Math.round(random() * 7 + input.chaosIntent * 0.25 + (10 - input.sleepLevel) * 0.12);
    elapsedMinutes += lapMinutes;

    fuelState = clamp(
      fuelState - (2.8 + input.hungerLevel * 0.52 + phaseFactor * 1.7 + (phase === "Damage Limitation" ? 0.8 : 0)),
      0,
      100,
    );
    tyreDeg = clamp(
      tyreDeg + (2.6 + (10 - input.socialBattery) * 0.52 + (10 - input.sleepLevel) * 0.28 + input.chaosIntent * 0.18),
      0,
      100,
    );
    ersReserve = clamp(
      ersReserve - (3.8 + phaseFactor * 2.2 + input.confidenceLevel * 0.12 - input.socialBattery * 0.08),
      0,
      100,
    );
    decisionQuality = clamp(
      decisionQuality - (0.9 + input.hungerLevel * 0.42 + input.chaosIntent * 0.35 + (10 - input.hydration) * phaseFactor * 0.85),
      0,
      100,
    );
    socialGrip = clamp(
      socialGrip - (0.8 + (10 - input.socialBattery) * 0.32 + phaseFactor * 1.1 + input.chaosIntent * 0.15),
      0,
      100,
    );
    incidentRisk = clamp(
      incidentRisk + (input.chaosIntent * 0.62 + input.riskAppetite * 0.35 + Math.max(0, 58 - decisionQuality) * 0.11 + phaseFactor * 4.4),
      0,
      100,
    );
    trackLimitsExposure = clamp(
      trackLimitsExposure + input.confidenceLevel * 0.22 + input.chaosIntent * 0.35 + Math.max(0, 60 - decisionQuality) * 0.15,
      0,
      100,
    );

    let flagState: FlagState = "GREEN";
    const markers: TelemetryFrame["markers"] = [];

    if (lap === 2) {
      pushFeed(lap, "GREEN", "Opening circulation complete. Driver comfort better than predicted." );
    }

    if (lap === supportStopPlannedLap && supportStopLap === null) {
      pushFeed(lap, "YELLOW", "Recommended food stop unavailable under declared budget policy.");
      markers.push({ segment: "Döner Sector", severity: "YELLOW", label: "Window Missed" });
    }

    if (supportStopLap && lap === supportStopLap) {
      fuelState = clamp(fuelState + 26 + input.budgetTolerance * 1.4, 0, 100);
      decisionQuality = clamp(decisionQuality + 12, 0, 100);
      socialGrip = clamp(socialGrip + 8, 0, 100);
      ersReserve = clamp(ersReserve + 13, 0, 100);
      tyreDeg = clamp(tyreDeg - 10, 0, 100);
      incidentRisk = clamp(incidentRisk - 11, 0, 100);
      pushFeed(lap, "GREEN", "Support stop complete. Nutrition and morale reintroduced to the package.");
      markers.push({ segment: "Döner Sector", severity: "GREEN", label: "Service Stop" });
    }

    if (safetyCarLap && lap === safetyCarLap) {
      flagState = "SAFETY CAR";
      incidentRisk = clamp(incidentRisk - 7, 0, 100);
      decisionQuality = clamp(decisionQuality + 4, 0, 100);
      ersReserve = clamp(ersReserve + 4, 0, 100);
      pushFeed(lap, "YELLOW", "Safety car deployed. Group dynamics temporarily self-correcting.");
      markers.push({ segment: "Social Hairpin", severity: "YELLOW", label: "Neutralised" });
    }

    if (lap === incidentLap) {
      const severe = incidentRisk > 84 || trackLimitsExposure > 86 || decisionQuality < 34;
      flagState = severe ? "RED" : "YELLOW";
      decisionQuality = clamp(decisionQuality - (severe ? 14 : 8), 0, 100);
      socialGrip = clamp(socialGrip - (severe ? 10 : 5), 0, 100);
      incidentRisk = clamp(incidentRisk + (severe ? 14 : 8), 0, 100);
      pushFeed(
        lap,
        severe ? "RED" : "ORANGE",
        severe
          ? "Unsafe conversational re-entry noted. Full containment procedures advised."
          : "Track limits warning issued for confidence exceeding available evidence.",
      );
      markers.push({ segment: "Re-entry Complex", severity: severe ? "RED" : "ORANGE", label: severe ? "Major Incident" : "Track Limits" });
    }

    if (lap === recoveryLap && decisionQuality > 32) {
      decisionQuality = clamp(decisionQuality + 6, 0, 100);
      socialGrip = clamp(socialGrip + 5, 0, 100);
      incidentRisk = clamp(incidentRisk - 4, 0, 100);
      pushFeed(lap, "GREEN", "Recovery window identified. Driver adopts reduced-ego operating mode.");
      markers.push({ segment: "Warm-Up Esses", severity: "GREEN", label: "Recovery" });
    }

    if (fuelState < 28 && lap !== supportStopLap) {
      pushFeed(lap, fuelState < 18 ? "ORANGE" : "YELLOW", "Nutrition deficit now visible in throttle application and judgement cadence.");
      markers.push({ segment: "Döner Sector", severity: fuelState < 18 ? "ORANGE" : "YELLOW", label: "Low Fuel" });
    }

    if (tyreDeg > 78) {
      pushFeed(lap, tyreDeg > 88 ? "RED" : "ORANGE", "Tyre management no longer looks convincing.");
      markers.push({ segment: "Regret Straight", severity: tyreDeg > 88 ? "RED" : "ORANGE", label: "Tyres Gone" });
    }

    if (incidentRisk > 74 && lap !== incidentLap) {
      pushFeed(lap, incidentRisk > 86 ? "ORANGE" : "YELLOW", "Incident probability rising through Sector 2.");
      markers.push({ segment: "Social Hairpin", severity: incidentRisk > 86 ? "ORANGE" : "YELLOW", label: "Rising Risk" });
    }

    const paceIndex = clamp(
      71 +
        input.sleepLevel * 1.8 +
        input.socialBattery * 1.7 +
        input.confidenceLevel * 1.25 -
        input.hungerLevel * 1.05 -
        tyreDeg * 0.18 -
        Math.max(0, 40 - fuelState) * 0.16 -
        Math.max(0, 55 - decisionQuality) * 0.24 +
        ersReserve * 0.07 +
        (random() - 0.5) * 4.8,
      28,
      98,
    );
    const paceDelta = clamp(round((78 - paceIndex) / 7 + (random() - 0.5) * 0.44, 1), -2.8, 6.5);

    const sectorScores = {
      s1: clamp(round(56 + input.sleepLevel * 2.1 + input.confidenceLevel * 1.4 - input.hungerLevel * 0.7 + (random() - 0.5) * 9), 0, 100),
      s2: clamp(round(52 + socialGrip * 0.32 + input.confidenceLevel * 0.8 - incidentRisk * 0.18 + (random() - 0.5) * 10), 0, 100),
      s3: clamp(round(48 + decisionQuality * 0.32 + input.hydration * 1.2 - tyreDeg * 0.24 - Math.max(0, 38 - fuelState) * 0.45 + (random() - 0.5) * 9), 0, 100),
    };
    const sectorPairs: Array<["S1" | "S2" | "S3", number]> = [
      ["S1", sectorScores.s1],
      ["S2", sectorScores.s2],
      ["S3", sectorScores.s3],
    ];
    const strongest = [...sectorPairs].sort((a, b) => b[1] - a[1])[0][0];
    const weakest = [...sectorPairs].sort((a, b) => a[1] - b[1])[0][0];

    if (flagState === "GREEN") {
      if (paceIndex >= 90) flagState = "PURPLE";
      else if (incidentRisk >= 82 || decisionQuality <= 24) flagState = "RED";
      else if (incidentRisk >= 64 || tyreDeg >= 74 || fuelState <= 22) flagState = "YELLOW";
    }

    const baseFrame = {
      lap,
      totalLaps,
      phase,
      elapsedMinutes,
      remainingMinutes: Math.max(0, average([totalLaps * 15 - elapsedMinutes, (totalLaps - lap) * 14])),
      flagState,
      conditionLabel: chooseConditionLabel(paceIndex, incidentRisk, tyreDeg, fuelState, flagState),
      trackCondition: chooseTrackCondition(incidentRisk, decisionQuality, socialGrip, flagState),
      activeSegment: TRACK_SEGMENTS[(lap - 1) % TRACK_SEGMENTS.length],
      paceIndex,
      paceDelta,
      tyreDeg: round(tyreDeg),
      fuelState: round(fuelState),
      ersReserve: round(ersReserve),
      incidentRisk: round(incidentRisk),
      decisionQuality: round(decisionQuality),
      socialGrip: round(socialGrip),
      kebabWindow: clamp(round(100 - Math.abs(lap - supportStopPlannedLap) * 18 - fuelState * 0.12 + input.hungerLevel * 4.4), 0, 100),
      trackLimitsExposure: round(trackLimitsExposure),
      incidentsTotal: incidentCount,
      sectorScores: {
        ...sectorScores,
        strongest,
        weakest,
      },
      feed: [...feed],
      strategyNotes: strategyFromState({
        fuelState,
        tyreDeg,
        decisionQuality,
        incidentRisk,
        kebabWindow: clamp(round(100 - Math.abs(lap - supportStopPlannedLap) * 18 - fuelState * 0.12 + input.hungerLevel * 4.4), 0, 100),
        hydration: input.hydration,
        phase,
      }),
      radio: radioFromState({
        flagState,
        incidentRisk,
        tyreDeg,
        fuelState,
        decisionQuality,
        lap,
      }),
      markers,
    } satisfies Omit<TelemetryFrame, "classification">;

    frames.push({
      ...baseFrame,
      classification: metricsForFrame(baseFrame, frames[frames.length - 1]),
    });
  }

  const bestFrame = [...frames].sort((a, b) => b.paceIndex - a.paceIndex)[0];
  const sectorAverages: Array<[string, number]> = [
    ["Sector 1", average(frames.map((frame) => frame.sectorScores.s1))],
    ["Sector 2", average(frames.map((frame) => frame.sectorScores.s2))],
    ["Sector 3", average(frames.map((frame) => frame.sectorScores.s3))],
  ];
  const weakestSector = [...sectorAverages].sort((a, b) => a[1] - b[1])[0][0];
  const tyreCliff = frames.find((frame) => frame.tyreDeg >= 76);
  const missedPitWindow = supportStopLap
    ? supportStopLap > supportStopPlannedLap + 1
      ? `Lap ${supportStopPlannedLap} was missed; stop finally taken on lap ${supportStopLap}.`
      : `No. Service taken within the recommended window on lap ${supportStopLap}.`
    : `Yes. Lap ${supportStopPlannedLap} was available, but the team never boxed.`;
  const overallScore =
    average(frames.map((frame) => frame.paceIndex)) * 0.45 +
    average(frames.map((frame) => frame.decisionQuality)) * 0.28 +
    average(frames.map((frame) => frame.socialGrip)) * 0.15 -
    incidentCount * 3.6;
  const finalPosition = clamp(Math.round(12 - overallScore / 10), 1, 12);

  const debrief: Debrief = {
    bestLap: `Lap ${bestFrame.lap} (${bestFrame.paceDelta > 0 ? "+" : ""}${bestFrame.paceDelta.toFixed(1)}s delta)`,
    weakestSector,
    peakPacePhase: bestFrame.phase,
    tyreCliffMoment: tyreCliff ? `Lap ${tyreCliff.lap}` : "No clear cliff; decline was progressive.",
    incidentCount,
    missedPitWindow,
    finalClassification: `P${finalPosition} / 12`,
    engineerVerdict:
      average(frames.map((frame) => frame.paceIndex)) > 80
        ? "Strong opening pace was real, but the evening still required better resource management in the central stint."
        : average(frames.map((frame) => frame.decisionQuality)) > 66
          ? "The package lacked headline speed, yet survived on discipline and timely restraint."
          : "Pace was occasionally visible. Session management rarely was.",
    stewardNotes:
      incidentCount === 0
        ? "No formal action. Observed behaviour remained within acceptable limits for this category."
        : incidentCount <= 2
          ? "One or more avoidable moments were logged. Further escalation was prevented by reduced expectations."
          : "Multiple breaches of operational judgement noted. Any appeal would struggle on available telemetry.",
    suggestedStrategy:
      input.hungerLevel >= 7 || supportStopLap === null
        ? "Pre-commit to a nutrition stop before the middle stint. The current gamble is not efficient."
        : input.chaosIntent >= 7
          ? "Reduce attack mode by one setting. The gain is theatrical, not strategic."
          : input.sleepLevel <= 4
            ? "Start on conservative mapping. The first clean laps are hiding the later drop-off."
            : "Maintain the current base setup, but protect Sector 2 from unnecessary confidence spikes.",
    highlights: [
      "Pace is acceptable but unsustainable.",
      supportStopLap
        ? `Support intervention on lap ${supportStopLap} materially improved the outlook.`
        : "No support intervention was completed despite clear strategic need.",
      weakestSector === "Sector 2"
        ? "Sector 2 remains the critical weakness under rising social temperature."
        : `Primary losses came through ${weakestSector.toLowerCase()} rather than outright lack of speed.`,
    ],
  };

  return {
    id: sessionId,
    startedAt: minutesToClock(startedAtMinutes),
    input,
    frames,
    qualifying,
    debrief,
  };
}
