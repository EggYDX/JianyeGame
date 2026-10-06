import { analyzePassword } from "../engine/analyzer";
import type { SeededRandom } from "../engine/random";
import type { WitnessProfile } from "../engine/witness";
import type { Phase, Predicate, RuleInstance } from "../engine/types";
import { describe } from "../copy/language";
import { validateRule } from "./validate";
import { mergeConstraint, type ConstraintContext } from "../engine/constraints";

export interface RuleDefinition {
  id: string;
  family: string;
  phases: Phase[];
  weight: number;
  difficulty: number;
  reads: string[];
  requires?: string[];
  instantiate: (w: WitnessProfile, rng: SeededRandom) => Predicate;
  declareConstraints: (
    c: ConstraintContext,
    p: Predicate,
  ) => ReturnType<typeof mergeConstraint>;
  validate: typeof validateRule;
  describe: typeof describe;
}
type DefinitionInput = Omit<
  RuleDefinition,
  "declareConstraints" | "validate" | "describe"
>;
const def = (d: DefinitionInput): RuleDefinition => ({
  ...d,
  declareConstraints: mergeConstraint,
  validate: validateRule,
  describe,
});
const count = (
  id: string,
  phase: Phase,
  category: "upper" | "lower" | "digit" | "punctuation" | "vowel",
  op: "min" | "max" | "exact",
) =>
  def({
    id,
    family: "count",
    phases: [phase],
    weight: 3,
    difficulty: 2,
    reads: [category, "length"],
    instantiate: (w, r) => ({
      kind: "count",
      category,
      op,
      value:
        op === "min"
          ? category === "lower"
            ? r.int(5, 8)
            : r.int(3, 5)
          : analyzePassword(w.text).counts[category] + (op === "max" ? 1 : 0),
    }),
  });
export const DEFINITIONS: RuleDefinition[] = [
  def({
    id: "minimum",
    family: "length",
    phases: [0],
    weight: 1,
    difficulty: 1,
    reads: ["length"],
    instantiate: (_, r) => ({
      kind: "length",
      op: "min",
      value: r.int(15, 20),
    }),
  }),
  ...(["digit", "upper", "punctuation"] as const).map((category) =>
    def({
      id: `basic-${category}`,
      family: "composition",
      phases: [0],
      weight: 1,
      difficulty: 1,
      reads: [category],
      instantiate: () => ({ kind: "count", category, op: "min", value: 1 }),
    }),
  ),
  def({
    id: "word",
    family: "semantic",
    phases: [1],
    weight: 6,
    difficulty: 2,
    reads: ["tokens", "lower"],
    instantiate: (w) => ({
      kind: "contains",
      options: w.options,
      sensitive: false,
    }),
  }),
  def({
    id: "code",
    family: "material",
    phases: [1],
    weight: 6,
    difficulty: 2,
    reads: ["code", "digit", "upper"],
    instantiate: (w) => ({
      kind: "contains",
      options: [w.code],
      sensitive: true,
    }),
  }),
  def({
    id: "forbidden",
    family: "forbidden",
    phases: [1],
    weight: 3,
    difficulty: 1,
    reads: ["characters"],
    instantiate: (w, r) => ({
      kind: "forbid",
      text: r.pick(
        ["@", "!", "%", "&", "X", "Z", "q"].filter((c) => !w.text.includes(c)),
      ),
    }),
  }),
  def({
    id: "repeat",
    family: "sequence",
    phases: [1],
    weight: 3,
    difficulty: 2,
    reads: ["lower", "characters"],
    instantiate: () => ({ kind: "repeat", category: "lower", size: 2 }),
  }),
  count("vowel-min", 1, "vowel", "min"),
  count("lower-min", 1, "lower", "min"),
  def({
    id: "digit-sum",
    family: "numeric",
    phases: [2],
    weight: 6,
    difficulty: 3,
    reads: ["digit", "sum"],
    instantiate: (w) => ({
      kind: "sum",
      value: analyzePassword(w.text).digitSum,
    }),
  }),
  def({
    id: "digit-run",
    family: "numeric-sequence",
    phases: [2],
    weight: 5,
    difficulty: 3,
    reads: ["digit", "position"],
    instantiate: (w) => ({
      kind: "sequence",
      direction: w.direction,
      size: w.sequenceSize,
    }),
  }),
  def({
    id: "first",
    family: "position",
    phases: [2],
    weight: 3,
    difficulty: 2,
    reads: ["position", "upper"],
    instantiate: () => ({ kind: "boundary", position: 1, category: "upper" }),
  }),
  def({
    id: "last",
    family: "position",
    phases: [2],
    weight: 2,
    difficulty: 2,
    reads: ["position", "upper"],
    instantiate: () => ({
      kind: "boundary",
      position: "last",
      category: "upper",
    }),
  }),
  count("digit-cap", 2, "digit", "max"),
  count("vowel-cap", 2, "vowel", "max"),
  def({
    id: "wrapped-word",
    family: "structure",
    phases: [3],
    weight: 5,
    difficulty: 3,
    reads: ["tokens", "punctuation", "position"],
    requires: ["word"],
    instantiate: (w) => ({ kind: "wrapped", options: w.options, pair: w.pair }),
  }),
  def({
    id: "material-order",
    family: "relative-position",
    phases: [3],
    weight: 4,
    difficulty: 3,
    reads: ["tokens", "code", "position"],
    requires: ["word", "code"],
    instantiate: (w) => ({ kind: "order", options: w.options, code: w.code }),
  }),
  def({
    id: "split-sum",
    family: "segment-arithmetic",
    phases: [3],
    weight: 6,
    difficulty: 4,
    reads: ["digit", "sum", "punctuation"],
    instantiate: (w) => {
      const [before, after] = w.text.split(w.marker);
      return {
        kind: "split",
        marker: w.marker,
        delta:
          analyzePassword(before).digitSum - analyzePassword(after).digitSum,
      };
    },
  }),
  def({
    id: "balance",
    family: "relational",
    phases: [3],
    weight: 6,
    difficulty: 4,
    reads: ["upper", "digit", "vowel", "punctuation"],
    instantiate: (w, r) => {
      const [a, b] = r.pick([
        ["digit", "punctuation"],
        ["upper", "punctuation"],
        ["vowel", "upper"],
      ] as const);
      const s = analyzePassword(w.text);
      return { kind: "balance", a, b, delta: s.counts[a] - s.counts[b] };
    },
  }),
  def({
    id: "digit-gap",
    family: "relational-position",
    phases: [3],
    weight: 3,
    difficulty: 3,
    reads: ["digit", "vowel", "position"],
    instantiate: () => ({ kind: "digitGap" }),
  }),
  def({
    id: "position",
    family: "position",
    phases: [3],
    weight: 3,
    difficulty: 3,
    reads: ["position", "upper", "lower", "digit"],
    instantiate: (w, r) => {
      const a = analyzePassword(w.text),
        position = r.int(
          Math.ceil(a.graphemes.length * 0.35),
          Math.floor(a.graphemes.length * 0.75),
        );
      return {
        kind: "boundary",
        position,
        category: a.categories[position - 1],
      };
    },
  }),
  def({
    id: "mirror",
    family: "local-symmetry",
    phases: [4],
    weight: 5,
    difficulty: 3,
    reads: ["position", "characters", "upper", "lower"],
    instantiate: () => ({ kind: "mirror", size: 3 }),
  }),
  count("upper-exact", 4, "upper", "exact"),
  count("punct-exact", 4, "punctuation", "exact"),
  count("digit-exact", 4, "digit", "exact"),
  count("vowel-exact", 4, "vowel", "exact"),
  def({
    id: "letter-run",
    family: "alphabet-sequence",
    phases: [1],
    weight: 4,
    difficulty: 2,
    reads: ["upper", "lower", "position"],
    instantiate: (w) => ({
      kind: "letterSequence",
      direction: w.alphabetDirection,
      size: 3,
    }),
  }),
  def({
    id: "different-digits",
    family: "numeric-diversity",
    phases: [1],
    weight: 3,
    difficulty: 2,
    reads: ["digit", "characters"],
    instantiate: (_, r) => ({ kind: "distinctDigits", min: r.int(3, 4) }),
  }),
  def({
    id: "word-once",
    family: "material-frequency",
    phases: [2],
    weight: 3,
    difficulty: 2,
    reads: ["tokens", "lower", "length"],
    requires: ["word"],
    instantiate: (w) => ({
      kind: "wordOccurrence",
      options: w.options,
      count: 1,
    }),
  }),
  def({
    id: "paired-brackets",
    family: "bracket-balance",
    phases: [2],
    weight: 3,
    difficulty: 2,
    reads: ["punctuation", "position"],
    instantiate: () => ({ kind: "bracketBalance" }),
  }),
  def({
    id: "material-gap",
    family: "bounded-spacing",
    phases: [3],
    weight: 4,
    difficulty: 3,
    reads: ["tokens", "code", "position", "length"],
    requires: ["word", "code"],
    instantiate: (w, r) => ({
      kind: "tokenGap",
      options: w.options,
      code: w.code,
      min: 2,
      max: r.int(4, 6),
    }),
  }),
  def({
    id: "digit-parity",
    family: "numeric-rhythm",
    phases: [3],
    weight: 4,
    difficulty: 3,
    reads: ["digit", "sum", "position"],
    instantiate: () => ({ kind: "alternatingParity", min: 4 }),
  }),
  def({
    id: "final-length",
    family: "length",
    phases: [4],
    weight: 1,
    difficulty: 3,
    reads: ["length", "characters"],
    instantiate: (w) => ({
      kind: "length",
      op: "exact",
      value: analyzePassword(w.text).graphemes.length,
    }),
  }),
];
export const NEW_CHALLENGE_IDS = new Set([
  "letter-run",
  "different-digits",
  "word-once",
  "paired-brackets",
  "material-gap",
  "digit-parity",
]);
export const REGISTRY = new Map(DEFINITIONS.map((d) => [d.id, d]));
export const evaluateRules = (rules: RuleInstance[], raw: string) => {
  const a = analyzePassword(raw);
  return { analysis: a, results: rules.map((r) => validateRule(r, a)) };
};
