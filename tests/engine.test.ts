import { describe, expect, test } from "vitest";
import fc from "fast-check";
import {
  analyzePassword,
  classify,
  validateAccount,
} from "../src/engine/analyzer";
import { emptyContext, mergeConstraint } from "../src/engine/constraints";
import { generateGame } from "../src/engine/generator";
import {
  initialState,
  transition,
  nextGateAt,
  MIN_DISPLAY_MS,
} from "../src/engine/game";
import { validatePredicate } from "../src/rules/validate";
import { SeededRandom } from "../src/engine/random";
import type { Predicate } from "../src/engine/types";
import { createHash } from "node:crypto";
import golden from "./golden.json";
import { CONTENT_VERSION } from "../src/data/materials";
const options = { seed: 241006, numRuns: 50, endOnFailure: true };

describe("Unicode and mutually exclusive categories", () => {
  test("counts graphemes without rewriting input", () => {
    const raw = "e\u0301鱼👩🏽‍💻🇨🇳1️⃣Ａa9! ";
    const a = analyzePassword(raw);
    expect(a.raw).toBe(raw);
    expect(a.graphemes.length).toBe(10);
    expect(a.counts).toEqual({
      upper: 0,
      lower: 1,
      digit: 1,
      punctuation: 1,
      whitespace: 1,
      other: 6,
      vowel: 1,
    });
    expect(a.matches(["e"]).length).toBe(0);
    expect(a.digitSum).toBe(9);
  });
  test("newline/control input retained and rejected", () => {
    for (const s of ["abc\n9!", "ab\t9!", "ab\u202e9!", "abc\u200b9!"]) {
      expect(analyzePassword(s).raw).toBe(s);
      expect(analyzePassword(s).valid).toBe(false);
    }
    expect(classify("鱼")).toBe("other");
    expect(classify("😀")).toBe("other");
    expect(classify(" ")).toBe("whitespace");
  });
  test("format limits and account validation", () => {
    expect(analyzePassword("鱼".repeat(257)).valid).toBe(false);
    expect(analyzePassword("a".repeat(8193)).valid).toBe(false);
    expect(validateAccount("　 ")).not.toBeNull();
    expect(validateAccount("鱼")).toBeNull();
    expect(validateAccount("👩‍💻".repeat(24))).toBeNull();
    expect(validateAccount("a".repeat(25))).not.toBeNull();
    expect(validateAccount("a".repeat(257))).toBe("账户名最多 24 个字符。");
    expect(validateAccount("a".repeat(8193))).toBe("账户名最多 24 个字符。");
    expect(validateAccount("a\n")).toContain("换行或隐藏字符");
  });
  test("all ASCII classifications exactly partition the input", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 32, max: 126 }), { maxLength: 100 }),
        (bytes) => {
          const a = analyzePassword(String.fromCharCode(...bytes));
          return (
            Object.entries(a.counts)
              .filter(([k]) => k !== "vowel")
              .reduce((s, [, n]) => s + n, 0) === a.graphemes.length
          );
        },
      ),
      options,
    );
  });
});
describe("constraints and validators", () => {
  const cases: [string, Predicate, string, string][] = [
    [
      "case-insensitive material",
      { kind: "contains", options: ["filed"], sensitive: false },
      "[FiLeD]",
      "folder",
    ],
    [
      "case-sensitive code",
      { kind: "contains", options: ["TX2"], sensitive: true },
      "TX2",
      "tx2",
    ],
    ["forbidden", { kind: "forbid", text: "@" }, "A1!", "A1@"],
    ["sum", { kind: "sum", value: 10 }, "91", "99"],
    [
      "count exact",
      { kind: "count", category: "punctuation", op: "exact", value: 1 },
      "A!鱼",
      "鱼😀",
    ],
    [
      "count max",
      { kind: "count", category: "digit", op: "max", value: 1 },
      "鱼9",
      "99",
    ],
    ["repeat", { kind: "repeat", category: "lower", size: 2 }, "jj", "jJ"],
    [
      "wrapped",
      { kind: "wrapped", options: ["filed"], pair: ["[", "]"] },
      "[filed]",
      "[ filed ]",
    ],
    [
      "first occurrence order",
      { kind: "order", options: ["filed"], code: "TX2" },
      "filedTX2",
      "TX2filedTX2",
    ],
    [
      "balance",
      { kind: "balance", a: "upper", b: "punctuation", delta: 1 },
      "AB!",
      "A!",
    ],
    [
      "single split marker",
      { kind: "split", marker: "#", delta: 2 },
      "5#3",
      "5##3",
    ],
    ["gap", { kind: "digitGap" }, "1bc2", "1ae2"],
    ["one-digit gap has no invented minimum", { kind: "digitGap" }, "a1b", ""],
    ["exact length", { kind: "length", op: "exact", value: 2 }, "鱼😀", "abc"],
    ["max length", { kind: "length", op: "max", value: 2 }, "a", "abc"],
  ];
  test.each(cases)(
    "%s has independent positive and negative fixtures",
    (_, predicate, positive, negative) => {
      expect(
        validatePredicate(predicate, analyzePassword(positive)).passed,
      ).toBe(true);
      expect(
        validatePredicate(predicate, analyzePassword(negative)).passed,
      ).toBe(false);
    },
  );
  test("multi-rule capacity and digit sum conflicts", () => {
    let c = mergeConstraint(emptyContext(), {
      kind: "length",
      op: "exact",
      value: 5,
    }).context;
    c = mergeConstraint(c, {
      kind: "count",
      category: "upper",
      op: "min",
      value: 2,
    }).context;
    c = mergeConstraint(c, {
      kind: "count",
      category: "lower",
      op: "min",
      value: 2,
    }).context;
    expect(
      mergeConstraint(c, {
        kind: "count",
        category: "digit",
        op: "min",
        value: 2,
      }).error,
    ).not.toBeNull();
    c = mergeConstraint(emptyContext(), {
      kind: "count",
      category: "digit",
      op: "exact",
      value: 1,
    }).context;
    expect(mergeConstraint(c, { kind: "sum", value: 25 }).error).not.toBeNull();
  });
  test("overlapping literals are not summed", () => {
    let c = mergeConstraint(emptyContext(), {
      kind: "length",
      op: "exact",
      value: 4,
    }).context;
    c = mergeConstraint(c, {
      kind: "contains",
      options: ["ABC"],
      sensitive: true,
    }).context;
    expect(
      mergeConstraint(c, {
        kind: "contains",
        options: ["BCD"],
        sensitive: true,
      }).error,
    ).toBeNull();
    expect(
      mergeConstraint(c, { kind: "forbid", text: "B" }).error,
    ).not.toBeNull();
  });
  test("sequence does not wrap; positions and mirror use graphemes", () => {
    expect(
      validatePredicate(
        { kind: "sequence", direction: 1, size: 3 },
        analyzePassword("890"),
      ).passed,
    ).toBe(false);
    expect(
      validatePredicate(
        { kind: "sequence", direction: -1, size: 3 },
        analyzePassword("321"),
      ).passed,
    ).toBe(true);
    expect(
      validatePredicate(
        { kind: "mirror", size: 2 },
        analyzePassword("鱼😀a😀鱼"),
      ).passed,
    ).toBe(true);
    expect(
      validatePredicate(
        { kind: "boundary", position: 2, category: "digit" },
        analyzePassword("👩‍💻1"),
      ).passed,
    ).toBe(true);
  });
  test("interval intersections are commutative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (min, max) => {
          const p = { kind: "length", op: "min", value: min } as const,
            q = { kind: "length", op: "max", value: max } as const;
          return (
            JSON.stringify(
              mergeConstraint(mergeConstraint(emptyContext(), p).context, q)
                .context.length,
            ) ===
            JSON.stringify(
              mergeConstraint(mergeConstraint(emptyContext(), q).context, p)
                .context.length,
            )
          );
        },
      ),
      options,
    );
  });
});
describe("determinism, contribution and fallback", () => {
  test("published content version matches committed golden plans", () => {
    for (const [seed, digest] of Object.entries(golden.fixtures)) {
      const plan = generateGame(seed, golden.version).plan;
      expect(
        createHash("sha256").update(JSON.stringify(plan)).digest("hex"),
      ).toBe(digest);
    }
  });
  test("same seed produces identical plan and proofs", () => {
    expect(generateGame("registration")).toEqual(generateGame("registration"));
  });
  test("independent RNG streams", () => {
    const a = new SeededRandom("same", "copy"),
      b = new SeededRandom("same", "copy"),
      other = new SeededRandom("same", "selection");
    other.int(0, 100);
    expect(a.int(0, 9999)).toBe(b.int(0, 9999));
  });
  test("forced full fallback is validated, not a partial run", () => {
    const g = generateGame("fallback", CONTENT_VERSION, {
      forceFallback: true,
    });
    expect(g.fallback).toBe(true);
    expect(g.plan.rules.length).toBeGreaterThanOrEqual(15);
    expect(g.plan.rules.length).toBeLessThanOrEqual(19);
    expect(g.contributions.length).toBe(g.plan.rules.length);
    expect(g).toEqual(
      generateGame("fallback", CONTENT_VERSION, { forceFallback: true }),
    );
  });
  test("exhausted candidate budget falls back without changing seed", () => {
    const g = generateGame("fallback", CONTENT_VERSION, { candidateBudget: 0 });
    expect(g.fallback).toBe(true);
    expect(g.attempts).toBe(17);
    expect(g.plan.seed).toBe("fallback");
  });
  test("unknown version and malformed seed rejected", () => {
    expect(() => generateGame("s", "99")).toThrow();
    expect(() => generateGame("../")).toThrow();
  });
});
