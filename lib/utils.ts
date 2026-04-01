import type { Severity } from "@/lib/types";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

export function round(value: number, precision = 0) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function scoreSeverity(value: number, reverse = false): Severity {
  const normalized = reverse ? 100 - value : value;
  if (normalized >= 88) return "PURPLE";
  if (normalized >= 68) return "GREEN";
  if (normalized >= 48) return "YELLOW";
  if (normalized >= 32) return "ORANGE";
  return "RED";
}

export function deltaSeverity(delta: number): Severity {
  if (delta <= -1.1) return "PURPLE";
  if (delta <= 0.4) return "GREEN";
  if (delta <= 1.6) return "YELLOW";
  if (delta <= 3.2) return "ORANGE";
  return "RED";
}

export function formatSigned(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function minutesToClock(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function minutesToDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function seedFromString(input: string) {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i += 1) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function mulberry32(seed: number) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createId(prefix: string, index: number) {
  return `${prefix}-${index}`;
}
