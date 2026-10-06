export type Category =
  "upper" | "lower" | "digit" | "punctuation" | "whitespace" | "other";
export type Metric = Category | "vowel";
export type Phase = 0 | 1 | 2 | 3 | 4;
export type Operator = "min" | "max" | "exact";
export type Predicate =
  | { kind: "length"; op: Operator; value: number }
  | { kind: "count"; category: Metric; op: Operator; value: number }
  | { kind: "contains"; options: string[]; sensitive: boolean }
  | { kind: "forbid"; text: string }
  | { kind: "sequence"; direction: 1 | -1; size: number }
  | { kind: "boundary"; position: number | "last"; category: Category }
  | { kind: "repeat"; category: Category; size: number }
  | { kind: "sum"; value: number }
  | { kind: "wrapped"; options: string[]; pair: [string, string] }
  | { kind: "order"; options: string[]; code: string }
  | { kind: "balance"; a: Metric; b: Metric; delta: number }
  | { kind: "split"; marker: string; delta: number }
  | { kind: "mirror"; size: number }
  | { kind: "digitGap" }
  | { kind: "letterSequence"; direction: 1 | -1; size: number }
  | { kind: "distinctDigits"; min: number }
  | { kind: "wordOccurrence"; options: string[]; count: number }
  | { kind: "bracketBalance" }
  | {
      kind: "tokenGap";
      options: string[];
      code: string;
      min: number;
      max: number;
    }
  | { kind: "alternatingParity"; min: number };
export interface RuleInstance {
  id: string;
  definitionId: string;
  ordinal: number;
  family: string;
  phase: Phase;
  difficulty: number;
  predicate: Predicate;
  copyVariant: number;
  reads: string[];
}
export interface RuleResult {
  passed: boolean;
  detail: string;
  fragments: string[];
}
export interface GamePlan {
  seed: string;
  version: string;
  rules: RuleInstance[];
  comments: { ordinal: number; text: string }[];
  presentation: { insertion: "register" | "amendment"; closing: number };
}
export interface GenerationTrace {
  definition: string;
  phase: Phase;
  attempt: number;
  accepted: boolean;
  reason: string;
}
export interface GeneratedGame {
  plan: GamePlan;
  witness: string;
  contributions: {
    ruleId: string;
    counterexample: string;
    affectedRules: string[];
  }[];
  trace: GenerationTrace[];
  fallback: boolean;
  attempts: number;
  context: unknown;
}
