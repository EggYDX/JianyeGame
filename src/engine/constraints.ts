import type { Predicate } from "./types";
interface Interval {
  min: number;
  max: number;
}
export interface ConstraintContext {
  length: Interval;
  counts: Record<string, Interval>;
  digitSum?: number;
  required: string[];
  forbidden: string[];
  positions: Record<string, string>;
  relations: Predicate[];
}
export function emptyContext(): ConstraintContext {
  return {
    length: { min: 0, max: 256 },
    counts: {},
    required: [],
    forbidden: [],
    positions: {},
    relations: [],
  };
}
export function mergeConstraint(
  previous: ConstraintContext,
  p: Predicate,
): { context: ConstraintContext; error: string | null } {
  const c: ConstraintContext = structuredClone(previous);
  const merge = (r: Interval, op: string, v: number) => {
    if (op !== "max") r.min = Math.max(r.min, v);
    if (op !== "min") r.max = Math.min(r.max, v);
  };
  if (p.kind === "length") merge(c.length, p.op, p.value);
  if (p.kind === "count") {
    c.counts[p.category] ??= { min: 0, max: 256 };
    merge(c.counts[p.category], p.op, p.value);
  }
  if (p.kind === "sum") {
    if (c.digitSum !== undefined && c.digitSum !== p.value)
      return { context: c, error: "数字和目标冲突" };
    c.digitSum = p.value;
  }
  if (p.kind === "contains" && p.options.length === 1 && p.sensitive)
    c.required.push(p.options[0]);
  if (p.kind === "forbid") c.forbidden.push(p.text);
  if (p.kind === "boundary") {
    const key = String(p.position);
    if (c.positions[key] && c.positions[key] !== p.category)
      return { context: c, error: "位置类别冲突" };
    c.positions[key] = p.category;
  }
  if (
    [
      "balance",
      "split",
      "wrapped",
      "order",
      "mirror",
      "digitGap",
      "tokenGap",
      "wordOccurrence",
      "bracketBalance",
      "alternatingParity",
      "distinctDigits",
      "letterSequence",
      "relativePosition",
    ].includes(p.kind)
  )
    c.relations.push(p);
  if (
    c.length.min > c.length.max ||
    Object.values(c.counts).some((r) => r.min > r.max)
  )
    return { context: c, error: "数量上下界冲突" };
  const disjointMinimum = Object.entries(c.counts)
    .filter(([k]) => k !== "vowel")
    .reduce((s, [, r]) => s + r.min, 0);
  if (disjointMinimum > c.length.max)
    return { context: c, error: "字符类别容量超过长度" };
  // Required literals may overlap: max is a sound lower bound; summation is not.
  if (c.required.some((s) => [...s].length > c.length.max))
    return { context: c, error: "必含片段超过长度" };
  if (c.required.some((s) => c.forbidden.some((f) => s.includes(f))))
    return { context: c, error: "必含与禁含冲突" };
  if (
    c.digitSum !== undefined &&
    c.digitSum > 9 * (c.counts.digit?.max ?? c.length.max)
  )
    return { context: c, error: "数字数量无法支持数字和" };
  for (const relation of c.relations)
    if (relation.kind === "balance") {
      const a = c.counts[relation.a],
        b = c.counts[relation.b];
      if (
        a &&
        b &&
        (a.min > b.max + relation.delta || a.max < b.min + relation.delta)
      )
        return { context: c, error: "计数关系冲突" };
    }
  if (p.kind === "wordOccurrence" && p.count < 1)
    return { context: c, error: "单词出现次数必须为正数" };
  if (p.kind === "tokenGap" && (p.min < 0 || p.min > p.max))
    return { context: c, error: "片段间距上下界冲突" };
  for (const relation of c.relations) {
    if (
      relation.kind === "relativePosition" &&
      c.relations.some(
        (r) =>
          r.kind === "relativePosition" &&
          r.code === relation.code &&
          r.side === relation.side &&
          r.category !== relation.category,
      )
    )
      return { context: c, error: "片段相邻类别冲突" };
    if (
      relation.kind === "wordOccurrence" &&
      c.relations.some(
        (r) =>
          r.kind === "wordOccurrence" &&
          JSON.stringify(r.options) === JSON.stringify(relation.options) &&
          r.count !== relation.count,
      )
    )
      return { context: c, error: "单词出现次数冲突" };
    if (
      relation.kind === "distinctDigits" &&
      relation.min > Math.min(10, c.counts.digit?.max ?? c.length.max)
    )
      return { context: c, error: "不同数字种类超过可用数量" };
    if (
      relation.kind === "alternatingParity" &&
      relation.min > (c.counts.digit?.max ?? c.length.max)
    )
      return { context: c, error: "奇偶交替所需数字数量超过上限" };
    if (relation.kind === "tokenGap") {
      const peers = c.relations.filter(
        (r): r is Extract<Predicate, { kind: "tokenGap" }> =>
          r.kind === "tokenGap" &&
          r.code === relation.code &&
          JSON.stringify(r.options) === JSON.stringify(relation.options),
      );
      if (
        Math.max(...peers.map((r) => r.min)) >
        Math.min(...peers.map((r) => r.max))
      )
        return { context: c, error: "片段间距冲突" };
    }
  }
  return { context: c, error: null };
}
