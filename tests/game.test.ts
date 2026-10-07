import { test, expect, describe } from "vitest";
import { generateGame } from "../src/engine/generator";
import {
  initialState,
  transition,
  nextGateAt,
  MIN_DISPLAY_MS,
} from "../src/engine/game";
import { analyzePassword } from "../src/engine/analyzer";
import corpus from "./corpus.json";
import { HEAVY_DIGIT_IDS, isExactCount } from "../src/rules/definitions";
const g = generateGame("registration");
const active = (name = "鱼") =>
  transition(
    transition(initialState("test"), { type: "ready", plan: g.plan, now: 0 }),
    { type: "account", username: name, now: 0 },
  );
const submit = () =>
  transition(transition(active(), { type: "input", raw: g.witness, now: 0 }), {
    type: "submit",
    now: 0,
  });
const gate = (s: ReturnType<typeof active>, now: number) =>
  transition(s, { type: "gate", revision: s.revision, sessionId: "test", now });
describe("first-submit protocol", () => {
  test("seed replacement rejects stale worker responses and cannot replace an active game", () => {
    let s = transition(initialState("old"), {
      type: "visibility",
      visible: false,
      now: 10,
    });
    s = transition(s, { type: "new-seed", sessionId: "new", now: 20 });
    expect(s.visible).toBe(false);
    expect(s.plan).toBeNull();
    expect(
      transition(s, { type: "ready", sessionId: "old", plan: g.plan, now: 30 }),
    ).toBe(s);
    s = transition(s, {
      type: "ready",
      sessionId: "new",
      plan: g.plan,
      now: 40,
    });
    s = transition(s, { type: "account", username: "鱼", now: 50 });
    expect(
      transition(s, { type: "new-seed", sessionId: "another", now: 60 }),
    ).toBe(s);
  });
  test("length is a seed-selected minimum 15–20; larger structures have room", () => {
    const values = new Set<number>();
    const starters = new Set<string>();
    for (const seed of corpus.slice(0, 12)) {
      const game = generateGame(seed);
      const starter = game.plan.rules.filter((r) => r.phase === 0);
      expect(starter.length).toBeGreaterThanOrEqual(3);
      expect(starter.length).toBeLessThanOrEqual(4);
      expect(
        starter.every((r) =>
          [
            "minimum",
            "basic-digit",
            "basic-upper",
            "basic-punctuation",
            "lower-min",
            "vowel-min",
            "repeat",
          ].includes(r.definitionId),
        ),
      ).toBe(true);
      starters.add(
        starter
          .map((r) => r.definitionId)
          .sort()
          .join(","),
      );
      expect(game.plan.rules.length).toBeGreaterThanOrEqual(15);
      expect(game.plan.rules.length).toBeLessThanOrEqual(19);
      expect(game.plan.rules.filter(isExactCount).length).toBeLessThanOrEqual(
        1,
      );
      expect(
        game.plan.rules.filter((r) => HEAVY_DIGIT_IDS.has(r.definitionId))
          .length,
      ).toBeLessThanOrEqual(2);
      expect(
        game.plan.rules.some((r) =>
          ["position", "final-length"].includes(r.definitionId),
        ),
      ).toBe(false);
      expect(
        game.plan.rules.some(
          (r) => r.phase === 4 && r.predicate.kind !== "count",
        ),
      ).toBe(true);
      const p = game.plan.rules[0].predicate;
      expect(p.kind).toBe("length");
      if (p.kind !== "length") throw new Error("wrong first rule");
      expect(p.op).toBe("min");
      expect(p.value).toBeGreaterThanOrEqual(15);
      expect(p.value).toBeLessThanOrEqual(20);
      values.add(p.value);
      const length = analyzePassword(game.witness).graphemes.length;
      expect(length).toBeGreaterThanOrEqual(36);
      expect(length).toBeLessThanOrEqual(42);
      expect(
        game.plan.rules
          .slice(0, 4)
          .filter((r) => r.predicate.kind === "length"),
      ).toHaveLength(1);
      const mirror = game.plan.rules.find((r) => r.predicate.kind === "mirror");
      if (mirror) expect(mirror.predicate).toEqual({ kind: "mirror", size: 3 });
    }
    expect(values.size).toBeGreaterThan(1);
    expect(starters.size).toBeGreaterThan(3);
  });
  test("no requirements or advance before first submit, even with a full solution", () => {
    let s = transition(active(), { type: "input", raw: g.witness, now: 0 });
    expect(s.revealedCount).toBe(0);
    expect(nextGateAt(s)).toBeNull();
    expect(gate(s, 9999).revealedCount).toBe(0);
    s = transition(s, { type: "submit", now: 10000 });
    expect(s.revealedCount).toBe(1);
    expect(nextGateAt(s)).toBe(11600);
  });
  test("failed submit reveals length and emits one shake event; typing emits none", () => {
    let s = transition(active(), { type: "input", raw: "tiny", now: 0 });
    expect(s.failureSerial).toBe(0);
    s = transition(s, { type: "submit", now: 10 });
    expect(s.revealedCount).toBe(1);
    expect(s.failureSerial).toBe(1);
    s = transition(s, { type: "input", raw: "tinyx", now: 20 });
    expect(s.failureSerial).toBe(1);
    expect(nextGateAt(s)).toBeNull();
  });
});
describe("monotonic reveal and reading time", () => {
  test("one pre-satisfied rule per interval; failing old rules never hides new ones", () => {
    let s = gate(submit(), MIN_DISPLAY_MS);
    expect(s.revealedCount).toBe(2);
    expect(gate(s, MIN_DISPLAY_MS).revealedCount).toBe(2);
    s = transition(s, { type: "input", raw: "", now: 1700 });
    expect(s.revealedCount).toBe(2);
    expect(nextGateAt(s)).toBeNull();
  });
  test("stale revision, wrong session, IME and background cannot advance", () => {
    let s = submit();
    const old = s.revision;
    expect(
      transition(s, {
        type: "gate",
        revision: old,
        sessionId: "wrong",
        now: 9999,
      }),
    ).toBe(s);
    s = transition(s, { type: "composition", active: true, now: 100 });
    expect(
      transition(s, {
        type: "gate",
        revision: old,
        sessionId: "test",
        now: 9999,
      }).revealedCount,
    ).toBe(1);
    expect(transition(s, { type: "submit", now: 9999 })).toBe(s);
    s = transition(s, { type: "composition", active: false, now: 200 });
    s = transition(s, { type: "visibility", visible: false, now: 300 });
    expect(nextGateAt(s)).toBeNull();
    s = transition(s, { type: "visibility", visible: true, now: 9999 });
    expect(nextGateAt(s)).toBe(11599);
  });
  test("final registration needs confirmation; completion cannot reveal more rules", () => {
    expect(active("张鱼").plan).toEqual(active("other").plan);
    let s = submit();
    for (let i = 1; i < g.plan.rules.length; i++)
      s = gate(s, i * MIN_DISPLAY_MS);
    expect(s.revealedCount).toBe(g.plan.rules.length);
    expect(s.stage).toBe("editing");
    expect(nextGateAt(s)).toBeNull();
    s = transition(s, {
      type: "submit",
      now: g.plan.rules.length * MIN_DISPLAY_MS,
    });
    s = gate(s, g.plan.rules.length * MIN_DISPLAY_MS);
    expect(s.stage).toBe("complete");
    for (const event of [
      { type: "input", raw: "", now: 999999 },
      { type: "account", username: "重发", now: 999999 },
      { type: "ready", plan: g.plan, now: 999999 },
    ] as const)
      expect(transition(s, event).revealedCount).toBe(g.plan.rules.length);
  });
  test("editing after final confirmation invalidates the pending completion", () => {
    let s = submit();
    for (let i = 1; i < g.plan.rules.length; i++)
      s = gate(s, i * MIN_DISPLAY_MS);
    s = transition(s, { type: "submit", now: s.lastReveal + 1 });
    expect(nextGateAt(s)).not.toBeNull();
    s = transition(s, { type: "input", raw: "", now: s.lastReveal + 2 });
    expect(nextGateAt(s)).toBeNull();
    expect(s.completionRequested).toBe(false);
  });
  test("account waits for plan; zero-reveal draft restores; saved pass not trusted", () => {
    let s = transition(initialState("test"), {
      type: "account",
      username: "用户",
      now: 0,
    });
    expect(s.stage).toBe("initializing");
    s = transition(s, { type: "ready", plan: g.plan, now: 1 });
    expect(s.revealedCount).toBe(0);
    const ready = transition(initialState("test"), {
      type: "ready",
      plan: g.plan,
      now: 0,
    });
    const saved = {
      seed: g.plan.seed,
      version: g.plan.version,
      username: "用户",
      raw: "draft",
      revealedCount: 0,
      complete: false,
    };
    expect(
      transition(ready, { type: "restore", saved, now: 0 }).revealedCount,
    ).toBe(0);
    const restored = transition(ready, {
      type: "restore",
      saved: {
        ...saved,
        raw: "",
        revealedCount: g.plan.rules.length,
        complete: true,
      },
      now: 0,
    });
    expect(restored.stage).toBe("editing");
    expect(restored.revealedCount).toBe(g.plan.rules.length);
  });
});
