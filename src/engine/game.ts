import { evaluateRules } from "../rules/definitions";
import { validateAccount } from "./analyzer";
import type { GamePlan } from "./types";
export const INPUT_SETTLE_MS = 250,
  MIN_DISPLAY_MS = 1600;
export interface GameState {
  stage:
    "account" | "initializing" | "editing" | "waiting" | "complete" | "error";
  sessionId: string;
  plan: GamePlan | null;
  username: string;
  accountConfirmed: boolean;
  raw: string;
  revealedCount: number;
  revision: number;
  composing: boolean;
  visible: boolean;
  lastEdit: number;
  lastReveal: number;
  error: string | null;
  failureSerial: number;
  completionRequested: boolean;
}
export const initialState = (sessionId: string, now = 0): GameState => ({
  stage: "account",
  sessionId,
  plan: null,
  username: "",
  accountConfirmed: false,
  raw: "",
  revealedCount: 0,
  revision: 0,
  composing: false,
  visible: true,
  lastEdit: now,
  lastReveal: now,
  error: null,
  failureSerial: 0,
  completionRequested: false,
});
export type GameEvent =
  | { type: "ready"; plan: GamePlan; now: number; sessionId?: string }
  | { type: "new-seed"; sessionId: string; now: number }
  | { type: "account"; username: string; now: number }
  | { type: "input"; raw: string; now: number }
  | { type: "submit"; now: number }
  | { type: "composition"; active: boolean; now: number }
  | { type: "visibility"; visible: boolean; now: number }
  | { type: "gate"; revision: number; sessionId: string; now: number }
  | { type: "restore"; saved: SavedSession; now: number }
  | { type: "error"; message: string };
export interface SavedSession {
  seed: string;
  version: string;
  username: string;
  raw: string;
  revealedCount: number;
  complete: boolean;
  inspectionEnabled?: boolean;
}
export function allRevealedPass(s: GameState): boolean {
  if (!s.plan || !s.revealedCount) return false;
  const e = evaluateRules(s.plan.rules.slice(0, s.revealedCount), s.raw);
  return e.analysis.valid && e.results.every((r) => r.passed);
}
const settled = (s: GameState): GameState => ({
  ...s,
  stage:
    s.visible &&
    !s.composing &&
    allRevealedPass(s) &&
    (s.revealedCount < s.plan!.rules.length || s.completionRequested)
      ? "waiting"
      : "editing",
});
export function nextGateAt(s: GameState): number | null {
  return s.stage === "waiting" && s.visible && !s.composing
    ? Math.max(s.lastEdit + INPUT_SETTLE_MS, s.lastReveal + MIN_DISPLAY_MS)
    : null;
}
export function transition(s: GameState, e: GameEvent): GameState {
  if (e.type === "new-seed")
    return s.accountConfirmed
      ? s
      : { ...initialState(e.sessionId, e.now), visible: s.visible };
  if (e.type === "ready" && e.sessionId && e.sessionId !== s.sessionId)
    return s;
  if (e.type === "visibility") {
    const n = {
      ...s,
      visible: e.visible,
      revision: s.revision + 1,
      lastReveal: e.visible ? e.now : s.lastReveal,
    };
    return ["editing", "waiting"].includes(s.stage) ? settled(n) : n;
  }
  if (e.type === "error") return { ...s, stage: "error", error: e.message };
  if (e.type === "ready")
    return s.plan
      ? s
      : s.accountConfirmed
        ? { ...s, plan: e.plan, stage: "editing", lastReveal: e.now }
        : { ...s, plan: e.plan };
  if (e.type === "account") {
    if (s.accountConfirmed || s.stage !== "account") return s;
    const error = validateAccount(e.username);
    if (error) return { ...s, error, failureSerial: s.failureSerial + 1 };
    return {
      ...s,
      username: e.username,
      accountConfirmed: true,
      error: null,
      stage: s.plan ? "editing" : "initializing",
      lastEdit: e.now,
      lastReveal: e.now,
    };
  }
  if (e.type === "restore") {
    const x = e.saved;
    if (
      s.accountConfirmed ||
      !s.plan ||
      x.seed !== s.plan.seed ||
      x.version !== s.plan.version ||
      validateAccount(x.username) ||
      typeof x.raw !== "string" ||
      !Number.isInteger(x.revealedCount) ||
      x.revealedCount < 0 ||
      x.revealedCount > s.plan.rules.length
    )
      return s;
    const n = {
      ...s,
      username: x.username,
      accountConfirmed: true,
      raw: x.raw,
      revealedCount: x.revealedCount,
      lastEdit: e.now,
      lastReveal: e.now,
    };
    return x.complete &&
      x.revealedCount === s.plan.rules.length &&
      allRevealedPass(n)
      ? { ...n, stage: "complete" }
      : settled(n);
  }
  if (["account", "initializing", "complete", "error"].includes(s.stage))
    return s;
  if (e.type === "input")
    return settled({
      ...s,
      raw: e.raw,
      revision: s.revision + 1,
      lastEdit: e.now,
      completionRequested: false,
    });
  if (e.type === "composition")
    return settled({
      ...s,
      composing: e.active,
      revision: s.revision + 1,
      lastEdit: e.now,
      completionRequested: false,
    });
  if (e.type === "submit") {
    if (s.composing || !s.visible || !s.plan) return s;
    // The first submit exposes exactly one requirement, even when already satisfied.
    const n =
      s.revealedCount === 0
        ? {
            ...s,
            revealedCount: 1,
            lastReveal: e.now,
            revision: s.revision + 1,
          }
        : s;
    if (!allRevealedPass(n))
      return { ...n, stage: "editing", failureSerial: s.failureSerial + 1 };
    return settled({
      ...n,
      completionRequested: n.revealedCount === n.plan!.rules.length,
    });
  }
  if (e.type === "gate") {
    const at = nextGateAt(s);
    if (
      e.sessionId !== s.sessionId ||
      e.revision !== s.revision ||
      at === null ||
      e.now < at ||
      !allRevealedPass(s)
    )
      return s;
    if (s.revealedCount === s.plan!.rules.length)
      return { ...s, stage: "complete" };
    return settled({
      ...s,
      revealedCount: s.revealedCount + 1,
      lastReveal: e.now,
    });
  }
  return s;
}
