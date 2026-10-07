import { describe, expect, test } from "vitest";
import { analyzePassword } from "../src/engine/analyzer";
import { validatePredicate } from "../src/rules/validate";
import { describe as copy } from "../src/copy/language";
import { mergeConstraint, emptyContext } from "../src/engine/constraints";
import { generateGame } from "../src/engine/generator";
import { REGISTRY } from "../src/rules/definitions";
import fc from "fast-check";
import { findContribution } from "../src/engine/contribution";
import { buildWitness } from "../src/engine/witness";
import { SeededRandom } from "../src/engine/random";
import type { RuleInstance } from "../src/engine/types";
import type { Predicate } from "../src/engine/types";

describe("authored structural and sequence rules", () => {
  const fixtures: [string, Predicate, string, string][] = [
    [
      "ascending alphabet",
      { kind: "letterSequence", size: 3, direction: 1 },
      "bCd",
      "b-d",
    ],
    [
      "descending alphabet",
      { kind: "letterSequence", size: 3, direction: -1 },
      "ZyX",
      "zab",
    ],
    ["digit diversity", { kind: "distinctDigits", min: 3 }, "01122", "111222"],
    [
      "one chosen word",
      { kind: "wordOccurrence", options: ["river", "cloud"], count: 1 },
      "xxRiVeRyy",
      "rivercloud",
    ],
    [
      "balanced nested brackets",
      { kind: "bracketBalance" },
      "[a{b}(c)]",
      "([)]",
    ],
    [
      "spacing by graphemes",
      { kind: "tokenGap", options: ["river"], code: "TX12", min: 2, max: 4 },
      "river👩‍💻鱼TX12",
      "TX12鱼👩‍💻river",
    ],
    [
      "global parity ignores letters",
      { kind: "alternatingParity", min: 4 },
      "0a1!2b3",
      "1a3!2b4",
    ],
  ];
  test.each(fixtures)(
    "%s has independent examples and precise copy",
    (_, p, yes, no) => {
      expect(validatePredicate(p, analyzePassword(yes)).passed).toBe(true);
      expect(validatePredicate(p, analyzePassword(no)).passed).toBe(false);
      expect(copy(p)).not.toMatch(/undefined|核验|归档/);
    },
  );
  test("ASCII boundaries, no alphabet wrap, insufficient digits and empty brackets", () => {
    const alphabet = { kind: "letterSequence", size: 3, direction: 1 } as const;
    for (const raw of ["zAb", "ｂｃｄ", "b\u0301cd"])
      expect(validatePredicate(alphabet, analyzePassword(raw)).passed).toBe(
        false,
      );
    expect(
      validatePredicate(
        { kind: "distinctDigits", min: 3 },
        analyzePassword("1️⃣２211"),
      ).passed,
    ).toBe(false);
    expect(
      validatePredicate(
        { kind: "alternatingParity", min: 4 },
        analyzePassword("12"),
      ).passed,
    ).toBe(false);
    for (const raw of ["abc!", "（abc）", "(abc", "abc)"])
      expect(
        validatePredicate({ kind: "bracketBalance" }, analyzePassword(raw))
          .passed,
      ).toBe(false);
    expect(
      validatePredicate({ kind: "bracketBalance" }, analyzePassword("()"))
        .passed,
    ).toBe(true);
  });
  test("word frequency includes overlapping occurrences and deduplicates equal matches", () => {
    expect(
      validatePredicate(
        { kind: "wordOccurrence", options: ["river"], count: 1 },
        analyzePassword("riveriver"),
      ).passed,
    ).toBe(false);
    expect(
      validatePredicate(
        { kind: "wordOccurrence", options: ["river", "RIVER"], count: 1 },
        analyzePassword("river"),
      ).passed,
    ).toBe(true);
  });
  test("spacing rejects both boundaries without losing complete grapheme matches", () => {
    const p = {
      kind: "tokenGap",
      options: ["river"],
      code: "TX12",
      min: 2,
      max: 4,
    } as const;
    expect(
      validatePredicate(
        { ...p, options: [...p.options] },
        analyzePassword("river!TX12"),
      ).passed,
    ).toBe(false);
    expect(
      validatePredicate(
        { ...p, options: [...p.options] },
        analyzePassword("river!!!!!TX12"),
      ).passed,
    ).toBe(false);
  });
  test("context catches incompatible spacing, capacities and word frequency", () => {
    const gap = {
      kind: "tokenGap",
      options: ["river"],
      code: "TX12",
      min: 2,
      max: 4,
    } as const;
    const context = mergeConstraint(emptyContext(), {
      ...gap,
      options: [...gap.options],
    }).context;
    expect(
      mergeConstraint(context, {
        ...gap,
        options: [...gap.options],
        min: 5,
        max: 6,
      }).error,
    ).not.toBeNull();
    const capped = mergeConstraint(emptyContext(), {
      kind: "count",
      category: "digit",
      op: "max",
      value: 2,
    }).context;
    expect(
      mergeConstraint(capped, { kind: "distinctDigits", min: 3 }).error,
    ).not.toBeNull();
    expect(
      mergeConstraint(capped, { kind: "alternatingParity", min: 4 }).error,
    ).not.toBeNull();
    const once = mergeConstraint(emptyContext(), {
      kind: "wordOccurrence",
      options: ["river"],
      count: 1,
    }).context;
    expect(
      mergeConstraint(once, {
        kind: "wordOccurrence",
        options: ["river"],
        count: 2,
      }).error,
    ).not.toBeNull();
  });
  test("all additions are part of the rule registry", () => {
    for (const id of [
      "letter-run",
      "different-digits",
      "word-once",
      "paired-brackets",
      "material-gap",
      "digit-parity",
      "relative-position",
    ])
      expect(REGISTRY.has(id)).toBe(true);
  });
  test("full fallback includes compatible additions and preserves its identity", () => {
    const g = generateGame("fallback", undefined, { forceFallback: true });
    expect(g.fallback).toBe(true);
    expect(g.plan.seed).toBe("fallback");
    expect(g.plan.rules.length).toBeGreaterThanOrEqual(15);
    expect(
      g.plan.rules.every(
        (r) =>
          validatePredicate(r.predicate, analyzePassword(g.witness)).passed,
      ),
    ).toBe(true);
  });
});

describe("relative code adjacency", () => {
  const before: Predicate = {
    kind: "relativePosition",
    code: "TX12",
    side: "before",
    category: "lower",
  };
  const after: Predicate = {
    kind: "relativePosition",
    code: "TX12",
    side: "after",
    category: "digit",
  };
  test("uses the first complete code and the adjacent grapheme", () => {
    for (const raw of ["TX12", "TX12aTX12", "a\u0301TX12", "a TX12", "aTX12\n"])
      expect(validatePredicate(before, analyzePassword(raw)).passed).toBe(
        false,
      );
    expect(validatePredicate(before, analyzePassword("👩‍💻aTX12")).passed).toBe(
      true,
    );
    expect(validatePredicate(after, analyzePassword("TX123👩‍💻")).passed).toBe(
      true,
    );
    for (const raw of ["TX12", "TX12鱼3", "TX12３", "TX121️⃣"])
      expect(validatePredicate(after, analyzePassword(raw)).passed).toBe(false);
    expect(copy(before)).toBe("最先出现的「TX12」前紧挨着一个小写英文字母。");
    expect(copy(after)).toContain("后紧挨着一个数字");
  });
  test("unrelated inserts preserve local adjacency", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("鱼", "👩‍💻", "e\u0301", " ", "!"), {
          maxLength: 40,
        }),
        (chars) => {
          const outside = chars.join("");
          return (
            validatePredicate(
              before,
              analyzePassword(outside + "aTX123" + outside),
            ).passed &&
            validatePredicate(
              after,
              analyzePassword(outside + "aTX123" + outside),
            ).passed
          );
        },
      ),
      { seed: 51007, numRuns: 50 },
    );
  });
  test("constraint conflicts and a genuine code-preserving counterexample", () => {
    const context = mergeConstraint(emptyContext(), before).context;
    expect(
      mergeConstraint(context, { ...before, category: "punctuation" }).error,
    ).not.toBeNull();
    expect(mergeConstraint(context, after).error).toBeNull();
    const w = buildWitness(new SeededRandom("relative", "test"));
    const make = (id: string, predicate: Predicate): RuleInstance => ({
      id,
      definitionId: id,
      ordinal: 1,
      family: "local",
      phase: 2,
      difficulty: 2,
      copyVariant: 0,
      reads: ["code"],
      predicate,
    });
    const previous = make("code", {
      kind: "contains",
      options: [w.code],
      sensitive: true,
    });
    for (const side of ["before", "after"] as const) {
      const candidate = make("relative-position", {
        kind: "relativePosition",
        code: w.code,
        side,
        category: side === "before" ? "lower" : "digit",
      });
      expect(
        validatePredicate(candidate.predicate, analyzePassword(w.text)).passed,
      ).toBe(true);
      const proof = findContribution([previous], candidate, w)!;
      expect(proof).not.toBeNull();
      const negative = analyzePassword(proof.counterexample);
      expect(validatePredicate(previous.predicate, negative).passed).toBe(true);
      expect(validatePredicate(candidate.predicate, negative).passed).toBe(
        false,
      );
    }
  });
  test("the fixed seed corpus actually selects adjacency", () => {
    const games = ["0", "137", "registration", "fallback"].map((seed) =>
      generateGame(seed),
    );
    expect(
      games.every((g) =>
        g.plan.rules.some((r) => r.definitionId === "relative-position"),
      ),
    ).toBe(true);
  });
});
