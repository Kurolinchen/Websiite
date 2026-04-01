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
  if (flagState === "RED") return "Sessionintegrität eingeschränkt";
  if (flagState === "SAFETY CAR") return "sozialer Verkehr neutralisiert";
  if (incidentRisk > 72) return "Low-Grip-Social-Conditions";
  if (decisionQuality < 45) return "abbauende Urteilsoberfläche";
  if (socialGrip > 78) return "stabiles Flow-Fenster";
  return "gemischte Traktion in den Kernsektoren";
}

function chooseConditionLabel(
  paceIndex: number,
  incidentRisk: number,
  tyreDeg: number,
  fuelState: number,
  flagState: FlagState,
) {
  if (flagState === "RED") return "Containment Protocol";
  if (flagState === "SAFETY CAR") return "Stabilisationsphase";
  if (paceIndex > 86 && incidentRisk < 32) return "Kontrollierter Vorteil";
  if (fuelState < 24 || tyreDeg > 72) return "Unterstützende Maßnahmen erforderlich";
  if (incidentRisk > 68) return "Gesprächsübersteuern";
  return "Operativ akzeptabel";
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
      detail: "Das Nahrungsfenster ist offen. Weiteres Warten verbessert die Reifensituation nicht.",
      severity: args.fuelState < 30 ? "ORANGE" : "YELLOW",
    });
  }

  if (args.incidentRisk >= 72) {
    notes.push({
      id: "heroics",
      label: "Keine Heldentaten",
      detail: "Bis zur Rückkehr stabiler Verhältnisse sind spekulative Gesprächsmanöver nicht freigegeben.",
      severity: "RED",
    });
  }

  if (args.tyreDeg >= 64) {
    notes.push({
      id: "manage",
      label: "Stint verwalten",
      detail: "Die Sozialbatterie überzeugt nicht mehr. Last senken, Kontakte verkürzen, unnötige Schleifen vermeiden.",
      severity: "ORANGE",
    });
  }

  if (args.hydration <= 3) {
    notes.push({
      id: "hydrate",
      label: "Vor dem nächsten Push hydrieren",
      detail: "Die verfügbare Evidenz trägt keine weitere Angriffslap auf dem aktuellen Flüssigkeitsstand.",
      severity: "YELLOW",
    });
  }

  if (args.decisionQuality >= 70 && args.incidentRisk < 45 && notes.length < 3) {
    notes.push({
      id: "stay-out",
      label: "Stay out",
      detail: "Die Lage ist derzeit beherrschbar. Rhythmus halten und keine zusätzliche Komplexität erzeugen.",
      severity: "GREEN",
    });
  }

  if (args.phase === "Damage Limitation" && notes.length < 3) {
    notes.push({
      id: "damage",
      label: "Modus wechseln",
      detail: "Ein sauberes Finish hat Vorrang vor späten Reputationsversuchen mit geringer Erfolgswahrscheinlichkeit.",
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
    calls.push({ id: `rc-${args.lap}`, who: "CONTROL", message: "Safety car. Neutralisieren und neu ordnen." });
  } else if (args.flagState === "RED") {
    calls.push({ id: `rc-${args.lap}`, who: "CONTROL", message: "Red flag. Weitere Heldentaten sind ausgesetzt." });
  } else if (args.fuelState < 28) {
    calls.push({ id: `engb-${args.lap}`, who: "ENGINEER", message: "Box, box. Das Fuel-Modell wirkt nicht mehr freundlich." });
  } else if (args.tyreDeg > 68) {
    calls.push({ id: `engt-${args.lap}`, who: "ENGINEER", message: "Tyres are gone. Ausgänge sauber halten." });
  } else if (args.incidentRisk > 66) {
    calls.push({ id: `engi-${args.lap}`, who: "ENGINEER", message: "Pace ist akzeptabel. Risiko nicht." });
  } else if (args.decisionQuality > 78) {
    calls.push({ id: `engg-${args.lap}`, who: "ENGINEER", message: "Fenster offen. Nutzen, nicht improvisieren." });
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
      ? "Die Eröffnungsphase wirkt ambitioniert. Die vorhandene Rückhaltekapazität stimmt dem nur teilweise zu."
      : input.confidenceLevel >= 7
        ? "Starker Launch wahrscheinlich, sofern die Appetitlage vor dem Mittelstint diszipliniert behandelt wird."
        : "Solide Eröffnung zu erwarten. Respektables Ergebnis, falls keine künstliche Dramatik erzeugt wird.";

  const risk =
    input.hydration <= 3
      ? "Ein Hydrationsdefizit wird das Bild im Spätstint erkennbar verfälschen."
      : input.hungerLevel >= 7
        ? "Die Ernährungsproblematik wird früher eintreffen, als der Fahrer derzeit öffentlich darstellt."
        : "Das Hauptrisiko bleibt Gesprächsübermut bei scheinbar besseren Bedingungen.";

  const pitWindow = clamp(Math.round(5 + (input.hungerLevel - input.budgetTolerance) / 2), 4, 10);

  return {
    projectedGrid: `P${projectedPosition} / 12`,
    expectedOpening: opening,
    startingRisk: risk,
    predictedPitWindow: `Lap ${pitWindow}–${pitWindow + 1}`,
    notes: [
      input.riskAppetite >= 7
        ? "Aggression ist verfügbar. Kontrolle bleibt weiterhin nur teilweise nachgewiesen."
        : "Ein konservativer Ansatz sollte ein glaubwürdiges Resultat ermöglichen.",
      input.sleepLevel <= 4
        ? "Die frühe Pace könnte den tatsächlichen Zustand des Fahrers schmeichelhaft falsch darstellen."
        : "Die Basistemperatur des Pakets wirkt bei Freigabe vertretbar.",
      input.budgetTolerance <= 3
        ? "Die Food-Strategie bleibt finanziell exponiert. Ein verpasstes Fenster ist plausibel."
        : "Das Stop-Budget ist ausreichend, um bei Bedarf eine Korrekturmaßnahme durchzuführen.",
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

  pushFeed(0, "GREEN", `Session freigegeben für ${input.trackName}. Baseline-Modell und Beobachtungslage online.`);

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
      pushFeed(lap, "GREEN", "Erste Umläufe abgeschlossen. Das Auftreten wirkt besser als intern befürchtet.");
    }

    if (lap === supportStopPlannedLap && supportStopLap === null) {
      pushFeed(lap, "YELLOW", "Empfohlener Food-Stop unter der deklarierten Budgetpolitik aktuell nicht darstellbar.");
      markers.push({ segment: "Döner Sector", severity: "YELLOW", label: "Window Missed" });
    }

    if (supportStopLap && lap === supportStopLap) {
      fuelState = clamp(fuelState + 26 + input.budgetTolerance * 1.4, 0, 100);
      decisionQuality = clamp(decisionQuality + 12, 0, 100);
      socialGrip = clamp(socialGrip + 8, 0, 100);
      ersReserve = clamp(ersReserve + 13, 0, 100);
      tyreDeg = clamp(tyreDeg - 10, 0, 100);
      incidentRisk = clamp(incidentRisk - 11, 0, 100);
      pushFeed(lap, "GREEN", "Support-Stop abgeschlossen. Nahrung, Moral und Restvernunft wurden dem Paket wieder zugeführt.");
      markers.push({ segment: "Döner Sector", severity: "GREEN", label: "Service Stop" });
    }

    if (safetyCarLap && lap === safetyCarLap) {
      flagState = "SAFETY CAR";
      incidentRisk = clamp(incidentRisk - 7, 0, 100);
      decisionQuality = clamp(decisionQuality + 4, 0, 100);
      ersReserve = clamp(ersReserve + 4, 0, 100);
      pushFeed(lap, "YELLOW", "Safety Car ausgerufen. Gruppendynamik beruhigt sich vorübergehend ohne erkennbaren Verdienst des Fahrers.");
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
          ? "Unsichere Gesprächs-Rückkehr festgestellt. Volle Containment-Maßnahmen empfohlen."
          : "Track-Limits-Verwarnung ausgesprochen. Das Selbstvertrauen übersteigt die aktuell verfügbare Beweislage.",
      );
      markers.push({ segment: "Re-entry Complex", severity: severe ? "RED" : "ORANGE", label: severe ? "Major Incident" : "Track Limits" });
    }

    if (lap === recoveryLap && decisionQuality > 32) {
      decisionQuality = clamp(decisionQuality + 6, 0, 100);
      socialGrip = clamp(socialGrip + 5, 0, 100);
      incidentRisk = clamp(incidentRisk - 4, 0, 100);
      pushFeed(lap, "GREEN", "Recovery-Fenster erkannt. Der Fahrer arbeitet vorübergehend mit reduziertem Ego-Mapping.");
      markers.push({ segment: "Warm-Up Esses", severity: "GREEN", label: "Recovery" });
    }

    if (fuelState < 28 && lap !== supportStopLap) {
      pushFeed(lap, fuelState < 18 ? "ORANGE" : "YELLOW", "Das Ernährungsdefizit ist nun in Gasannahme, Geduld und Satzbau sichtbar.");
      markers.push({ segment: "Döner Sector", severity: fuelState < 18 ? "ORANGE" : "YELLOW", label: "Low Fuel" });
    }

    if (tyreDeg > 78) {
      pushFeed(lap, tyreDeg > 88 ? "RED" : "ORANGE", "Tyre Management wirkt nicht länger überzeugend. Die Sozialbatterie ist operativ angezählt.");
      markers.push({ segment: "Regret Straight", severity: tyreDeg > 88 ? "RED" : "ORANGE", label: "Tyres Gone" });
    }

    if (incidentRisk > 74 && lap !== incidentLap) {
      pushFeed(lap, incidentRisk > 86 ? "ORANGE" : "YELLOW", "Die Incident-Wahrscheinlichkeit steigt durch Sector 2 in unerfreulicher Klarheit an.");
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

    const kebabWindow = clamp(round(100 - Math.abs(lap - supportStopPlannedLap) * 18 - fuelState * 0.12 + input.hungerLevel * 4.4), 0, 100);

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
      kebabWindow,
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
        kebabWindow,
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
      ? `Ja. Lap ${supportStopPlannedLap} war verfügbar; gestoppt wurde jedoch erst in Lap ${supportStopLap}.`
      : `Nein. Der Support-Stop erfolgte regelkonform in Lap ${supportStopLap}.`
    : `Ja. Lap ${supportStopPlannedLap} war verfügbar, das Team hat jedoch nie geboxt.`;
  const overallScore =
    average(frames.map((frame) => frame.paceIndex)) * 0.45 +
    average(frames.map((frame) => frame.decisionQuality)) * 0.28 +
    average(frames.map((frame) => frame.socialGrip)) * 0.15 -
    incidentCount * 3.6;
  const finalPosition = clamp(Math.round(12 - overallScore / 10), 1, 12);

  const debrief: Debrief = {
    bestLap: `Lap ${bestFrame.lap} (${bestFrame.paceDelta > 0 ? "+" : ""}${bestFrame.paceDelta.toFixed(1)}s Delta)`,
    weakestSector,
    peakPacePhase: bestFrame.phase,
    tyreCliffMoment: tyreCliff ? `Lap ${tyreCliff.lap}` : "Kein klarer Cliff; der Abfall war progressiv.",
    incidentCount,
    missedPitWindow,
    finalClassification: `P${finalPosition} / 12`,
    engineerVerdict:
      average(frames.map((frame) => frame.paceIndex)) > 80
        ? "Die starke Eröffnungspace war real, der Mittelstint wurde jedoch unnötig nachlässig verwaltet."
        : average(frames.map((frame) => frame.decisionQuality)) > 66
          ? "Dem Paket fehlte Schlagzeilenspeed, es überlebte jedoch durch Disziplin und rechtzeitige Zurückhaltung."
          : "Pace war phasenweise sichtbar. Session-Management deutlich seltener.",
    stewardNotes:
      incidentCount === 0
        ? "Keine formalen Maßnahmen. Das beobachtete Verhalten blieb für diese Kategorie innerhalb akzeptabler Grenzen."
        : incidentCount <= 2
          ? "Ein oder mehrere vermeidbare Momente wurden protokolliert. Weitere Eskalation wurde eher durch sinkende Erwartungen als durch Kontrolle verhindert."
          : "Mehrere Verstöße gegen operative Urteilsfähigkeit festgestellt. Eine Berufung hätte auf Basis der Telemetrie wenig Substanz.",
    suggestedStrategy:
      input.hungerLevel >= 7 || supportStopLap === null
        ? "Für die nächste Session ist ein Food-Stop vor dem Mittelstint verbindlich einzuplanen. Die aktuelle Wette ist ineffizient."
        : input.chaosIntent >= 7
          ? "Attack Mode um eine Stufe reduzieren. Der Mehrwert ist überwiegend theatralisch, nicht strategisch."
          : input.sleepLevel <= 4
            ? "Mit konservativem Mapping starten. Die ersten sauberen Laps kaschieren derzeit den späteren Einbruch."
            : "Das Grundsetup kann bleiben, Sector 2 ist jedoch strenger vor unnötigen Confidence-Spikes zu schützen.",
    highlights: [
      "Die Pace ist akzeptabel, aber auf diesem Profil nicht nachhaltig.",
      supportStopLap
        ? `Der Support-Eingriff in Lap ${supportStopLap} hat die Gesamtlage messbar stabilisiert.`
        : "Trotz klarer strategischer Notwendigkeit wurde kein Support-Eingriff durchgeführt.",
      weakestSector === "Sector 2"
        ? "Sector 2 bleibt die kritische Schwäche unter steigender sozialer Temperatur."
        : `Die Hauptverluste entstanden in ${weakestSector.toLowerCase()} und nicht durch blanken Geschwindigkeitsmangel.`,
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
