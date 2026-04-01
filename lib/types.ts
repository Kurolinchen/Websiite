export type Screen = "landing" | "setup" | "dashboard" | "debrief";

export type SessionType =
  | "Casual Run"
  | "Full Send"
  | "Damage Limitation"
  | "Recovery Drive"
  | "Unknown Conditions";

export type FlagState =
  | "GREEN"
  | "YELLOW"
  | "SAFETY CAR"
  | "RED"
  | "PURPLE";

export type Severity = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "PURPLE";

export type Phase =
  | "Warm-up"
  | "Build Phase"
  | "Mid-Stint"
  | "Stabilisation"
  | "Damage Limitation"
  | "Final Push";

export type SessionInput = {
  driverName: string;
  teamName: string;
  sessionType: SessionType;
  trackName: string;
  sleepLevel: number;
  hungerLevel: number;
  confidenceLevel: number;
  socialBattery: number;
  chaosIntent: number;
  budgetTolerance: number;
  hydration: number;
  riskAppetite: number;
};

export type FeedItem = {
  id: string;
  lap: number;
  timestamp: string;
  message: string;
  severity: Severity;
};

export type StrategyNote = {
  id: string;
  label: string;
  detail: string;
  severity: Severity;
};

export type RadioCall = {
  id: string;
  who: "ENGINEER" | "CONTROL" | "DRIVER";
  message: string;
};

export type SectorScores = {
  s1: number;
  s2: number;
  s3: number;
  strongest: "S1" | "S2" | "S3";
  weakest: "S1" | "S2" | "S3";
};

export type ClassificationMetric = {
  key:
    | "pace"
    | "delta"
    | "tyre"
    | "fuel"
    | "ers"
    | "incident"
    | "decision"
    | "social"
    | "kebab";
  label: string;
  value: string;
  numericValue: number;
  trend: -1 | 0 | 1;
  severity: Severity;
};

export type TelemetryFrame = {
  lap: number;
  totalLaps: number;
  phase: Phase;
  elapsedMinutes: number;
  remainingMinutes: number;
  flagState: FlagState;
  conditionLabel: string;
  trackCondition: string;
  activeSegment: string;
  paceIndex: number;
  paceDelta: number;
  tyreDeg: number;
  fuelState: number;
  ersReserve: number;
  incidentRisk: number;
  decisionQuality: number;
  socialGrip: number;
  kebabWindow: number;
  trackLimitsExposure: number;
  incidentsTotal: number;
  sectorScores: SectorScores;
  classification: ClassificationMetric[];
  feed: FeedItem[];
  strategyNotes: StrategyNote[];
  radio: RadioCall[];
  markers: Array<{
    segment: string;
    severity: Severity;
    label: string;
  }>;
};

export type QualifyingReport = {
  projectedGrid: string;
  expectedOpening: string;
  startingRisk: string;
  predictedPitWindow: string;
  notes: string[];
};

export type Debrief = {
  bestLap: string;
  weakestSector: string;
  peakPacePhase: string;
  tyreCliffMoment: string;
  incidentCount: number;
  missedPitWindow: string;
  finalClassification: string;
  engineerVerdict: string;
  stewardNotes: string;
  suggestedStrategy: string;
  highlights: string[];
};

export type SimulatedSession = {
  id: string;
  startedAt: string;
  input: SessionInput;
  frames: TelemetryFrame[];
  qualifying: QualifyingReport;
  debrief: Debrief;
};
