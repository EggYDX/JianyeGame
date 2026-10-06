export const STALL_MS = 120_000;
export interface AssistanceState {
  score: number;
  active: boolean;
  elapsed: number;
  updatedAt: number;
  offered: boolean;
  enabled: boolean;
  declined: boolean;
}
export const createAssistance = (
  now: number,
  enabled = false,
): AssistanceState => ({
  score: 0,
  active: false,
  elapsed: 0,
  updatedAt: now,
  offered: false,
  enabled,
  declined: false,
});
export function syncAssistance(
  s: AssistanceState,
  score: number,
  active: boolean,
  now: number,
): AssistanceState {
  const progressed = score > s.score;
  const elapsed = progressed
    ? 0
    : s.elapsed + (s.active ? Math.max(0, now - s.updatedAt) : 0);
  return {
    ...s,
    score: Math.max(score, s.score),
    active,
    elapsed,
    updatedAt: now,
    offered: progressed ? false : s.offered,
    declined: progressed ? false : s.declined,
  };
}
export function assistanceDueAt(s: AssistanceState): number | null {
  return s.active && s.score > 0 && !s.enabled && !s.declined && !s.offered
    ? s.updatedAt + Math.max(0, STALL_MS - s.elapsed)
    : null;
}
export function checkAssistance(
  s: AssistanceState,
  now: number,
): AssistanceState {
  const next = syncAssistance(s, s.score, s.active, now);
  const due = assistanceDueAt(next);
  return due !== null && now >= due ? { ...next, offered: true } : next;
}
