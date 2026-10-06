import { analyzePassword } from "./analyzer";
import { validateRule } from "../rules/validate";
import type { RuleInstance } from "./types";
import type { WitnessProfile } from "./witness";

function* mutations(
  w: WitnessProfile,
  candidate: RuleInstance,
): Generator<string> {
  const s = w.text,
    p = candidate.predicate;
  const replace = (i: number, c: string) => s.slice(0, i) + c + s.slice(i + 1);
  yield "";
  if (p.kind === "length" && p.op === "min") yield s.slice(0, p.value - 1);
  // Whole-category changes are needed to certify basic presence requirements.
  yield s.replace(/[0-9]/g, "x");
  yield s.toLowerCase();
  yield s.replace(/[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/g, "x");
  yield s.replace(/[aeiouAEIOU]/g, "x");
  for (const option of w.options)
    yield s.replace(new RegExp(w.word, "i"), option);
  if (p.kind === "order") {
    const start = s.indexOf(w.pair[0]),
      end = s.indexOf(w.pair[1]) + 1,
      codeStart = s.indexOf(w.code);
    yield s.slice(0, start) +
      w.code +
      s.slice(start, end) +
      s.slice(end, codeStart) +
      s.slice(codeStart + w.code.length);
  }
  if (p.kind === "wrapped") {
    yield s.replace(w.pair[0], "!");
    yield s.replace(w.pair[1], "!");
  }
  if (p.kind === "contains")
    for (const option of p.options)
      yield s
        .replace(option, option.slice(0, -1) + "?")
        .replace(option[0].toUpperCase() + option.slice(1), "zz");
  if (p.kind === "forbid") yield s.slice(0, -2) + p.text + s.slice(-2);
  if (p.kind === "distinctDigits") {
    const codeStart = s.indexOf(w.code);
    const keepDigit = w.code.match(/[0-9]/)![0];
    yield [...s]
      .map((g, i) =>
        /[0-9]/.test(g) && !(i >= codeStart && i < codeStart + w.code.length)
          ? keepDigit
          : g,
      )
      .join("");
  }
  if (p.kind === "wordOccurrence") {
    yield s.slice(0, -3) + w.word + s.slice(-3);
    yield s.slice(0, w.freeOffset) + w.word + s.slice(w.freeOffset);
  }
  if (p.kind === "tokenGap") {
    const index = s.indexOf(w.code);
    yield s.slice(0, index) + "鱼".repeat(p.max + 1) + s.slice(index);
    const word = analyzePassword(s).matches(p.options, false)[0];
    if (word) yield s.slice(0, word.end) + s.slice(index);
  }
  if (p.kind === "split") {
    yield s.replace(w.marker, "!");
    yield s.slice(0, -2) + w.marker + s.slice(-2);
  }
  const preferred =
    p.kind === "count"
      ? {
          upper: "Z",
          lower: "x",
          digit: "0",
          vowel: "a",
          punctuation: "!",
          whitespace: " ",
          other: "鱼",
        }[p.category]
      : "鱼";
  // End-adjacent insertion preserves existing material positions and the mirrored suffix.
  yield s.slice(0, -2) + preferred + s.slice(-2);
  yield s.slice(0, -2) + preferred.repeat(3) + s.slice(-2);
  for (let i = 0; i < s.length; i++) {
    yield s.slice(0, i) + s.slice(i + 1);
    for (const c of [preferred, "Z", "x", "a", "0", "9", "!", "鱼"])
      if (c !== s[i]) yield replace(i, c);
    yield s.slice(0, i) + preferred + s.slice(i);
    if (i + 1 < s.length)
      yield s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
  }
  // Preserve digit sum while breaking a sequence, distribution or position.
  const positions = [...s]
    .map((c, i) => (/[0-9]/.test(c) ? i : -1))
    .filter((i) => i >= 0);
  for (const i of positions)
    for (const j of positions)
      if (i !== j) {
        for (const d of [-1, 1]) {
          const x = Number(s[i]) + d,
            y = Number(s[j]) - d;
          if (x >= 0 && x <= 9 && y >= 0 && y <= 9) {
            const a = [...s];
            a[i] = String(x);
            a[j] = String(y);
            yield a.join("");
          }
        }
      }
  // Toggle opposite cases together: preserves counts and case-insensitive material.
  for (let i = 0; i < s.length; i++)
    if (/[A-Z]/.test(s[i]))
      for (let j = 0; j < s.length; j++)
        if (/[a-z]/.test(s[j])) {
          const a = [...s];
          a[i] = s[i].toLowerCase();
          a[j] = s[j].toUpperCase();
          yield a.join("");
        }
}
export function findContribution(
  previous: RuleInstance[],
  candidate: RuleInstance,
  w: WitnessProfile,
): { counterexample: string; affectedRules: string[] } | null {
  const seen = new Set<string>();
  let attempts = 0;
  for (const text of mutations(w, candidate)) {
    if (++attempts > 1024) break;
    if (seen.has(text)) continue;
    seen.add(text);
    const a = analyzePassword(text);
    if (
      a.valid &&
      !validateRule(candidate, a).passed &&
      previous.every((r) => validateRule(r, a).passed)
    ) {
      return {
        counterexample: text,
        affectedRules: previous
          .filter((r) => r.reads.some((f) => candidate.reads.includes(f)))
          .map((r) => r.id),
      };
    }
  }
  return null;
}
