import { describe, expect, test } from "vitest";
import { analyzePassword } from "../src/engine/analyzer";
import { validatePredicate } from "../src/rules/validate";
import { describe as copy } from "../src/copy/language";
import { mergeConstraint, emptyContext } from "../src/engine/constraints";
import { generateGame } from "../src/engine/generator";
import { DEFINITIONS, NEW_CHALLENGE_IDS } from "../src/rules/definitions";
import type { Predicate } from "../src/engine/types";

describe("six authored additions", () => {
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
    expect(
      new Set(
        DEFINITIONS.filter((d) => NEW_CHALLENGE_IDS.has(d.id)).map((d) => d.id),
      ),
    ).toEqual(NEW_CHALLENGE_IDS);
    expect(DEFINITIONS).toHaveLength(34);
  });
  test("full fallback includes compatible additions and preserves its identity", () => {
    const g = generateGame("fallback", undefined, { forceFallback: true });
    expect(g.fallback).toBe(true);
    expect(g.plan.seed).toBe("fallback");
    const added = g.plan.rules.filter((r) =>
      NEW_CHALLENGE_IDS.has(r.definitionId),
    );
    expect(added.length).toBeGreaterThanOrEqual(2);
    expect(added.length).toBeLessThanOrEqual(3);
    expect(
      g.plan.rules.every(
        (r) =>
          validatePredicate(r.predicate, analyzePassword(g.witness)).passed,
      ),
    ).toBe(true);
  });
});
