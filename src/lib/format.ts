import type { Outcome } from "./types";

const DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const DAY = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function formatStamp(ms: number): string {
  return DATE.format(new Date(ms));
}

export function formatDay(ms: number): string {
  return DAY.format(new Date(ms));
}

/** `4d 02h 11m`, `02h 11m 09s`, or `due` once the resolution date has passed. */
export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "due";
  const total = Math.floor(msLeft / 1000);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  if (hours > 0) return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  return `${pad(minutes)}m ${pad(seconds)}s`;
}

export function shortHash(hash: string): string {
  return hash.length <= 20 ? hash : `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

export const OUTCOME_LABEL: { [K in Outcome]: string } = {
  win: "right",
  loss: "wrong",
  partial: "partial",
};

/** Violet for a hit, heat for a split call, neutral for a miss. No red or green anywhere. */
export const OUTCOME_TONE: { [K in Outcome]: "violet" | "heat" | "neutral" } = {
  win: "violet",
  loss: "neutral",
  partial: "heat",
};

/** Local datetime-local value (`YYYY-MM-DDTHH:mm`) for an instant. */
export function toDateTimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
