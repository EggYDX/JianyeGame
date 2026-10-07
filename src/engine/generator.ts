import { CONTENT_VERSION } from "../data/materials";
import {
  DEFINITIONS,
  REGISTRY,
  HEAVY_DIGIT_IDS,
  isExactCount,
  type RuleDefinition,
} from "../rules/definitions";
import { validateRule } from "../rules/validate";
import { analyzePassword } from "./analyzer";
import { emptyContext, mergeConstraint } from "./constraints";
import { findContribution } from "./contribution";
import { SeededRandom } from "./random";
import { buildWitness } from "./witness";
import type {
  GeneratedGame,
  GenerationTrace,
  Phase,
  RuleInstance,
} from "./types";

export class GenerationFailure extends Error {
  constructor(
    public seed: string,
    public trace: GenerationTrace[],
  ) {
    super(`无法构造完整的已验证游戏：${seed}`);
  }
}
export function generateGame(
  seed: string,
  version = CONTENT_VERSION,
  options: { forceFallback?: boolean; candidateBudget?: number } = {},
): GeneratedGame {
  if (version !== CONTENT_VERSION) throw new Error("不支持该内容版本。");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(seed)) throw new Error("seed 格式无效。");
  const trace: GenerationTrace[] = [];
  for (let construction = 0; construction < 17; construction++) {
    const fallback = options.forceFallback === true || construction === 16;
    if (options.forceFallback && construction > 0) break;
    const stream = `${fallback ? "fallback" : "normal"}:${construction}`;
    const structure = new SeededRandom(seed, `${stream}:structure`),
      selection = new SeededRandom(seed, `${stream}:selection`),
      params = new SeededRandom(seed, `${stream}:parameters`),
      copy = new SeededRandom(seed, `${stream}:copy`);
    const w = buildWitness(structure, fallback),
      wa = analyzePassword(w.text);
    let context = emptyContext();
    const rules: RuleInstance[] = [],
      contributions: GeneratedGame["contributions"] = [];
    const used = new Set<string>(),
      signatures = new Set<string>();
    let failed = false;
    const accept = (definition: RuleDefinition, phase: Phase): boolean => {
      const predicate = definition.instantiate(w, params),
        signature = JSON.stringify(predicate);
      const candidate: RuleInstance = {
        id: `${definition.id}-${rules.length + 1}`,
        definitionId: definition.id,
        ordinal: rules.length + 1,
        family: definition.family,
        phase,
        difficulty: definition.difficulty,
        reads: definition.reads,
        predicate,
        copyVariant: copy.int(0, 1),
      };
      const merged = definition.declareConstraints(context, predicate);
      const reason = signatures.has(signature)
        ? "重复约束"
        : merged.error
          ? merged.error
          : !validateRule(candidate, wa).passed
            ? "Witness 不满足候选"
            : null;
      if (reason) {
        trace.push({
          definition: definition.id,
          phase,
          attempt: construction,
          accepted: false,
          reason,
        });
        return false;
      }
      const proof = findContribution(rules, candidate, w);
      if (!proof || (phase >= 3 && proof.affectedRules.length < 2)) {
        trace.push({
          definition: definition.id,
          phase,
          attempt: construction,
          accepted: false,
          reason: proof ? "组合联系不足" : "未取得非冗余反例",
        });
        return false;
      }
      context = merged.context;
      rules.push(candidate);
      signatures.add(signature);
      used.add(definition.id);
      contributions.push({ ruleId: candidate.id, ...proof });
      trace.push({
        definition: definition.id,
        phase,
        attempt: construction,
        accepted: true,
        reason: "存在解与贡献证据通过",
      });
      return true;
    };
    const targets = [
      structure.int(3, 4),
      4,
      4,
      structure.int(3, 4),
      structure.int(1, 2),
    ];
    if (!accept(REGISTRY.get("minimum")!, 0)) failed = true;
    for (const d of selection.shuffle(
      DEFINITIONS.filter((d) => d.phases.includes(0) && d.id !== "minimum"),
    )) {
      if (rules.length === targets[0]) break;
      accept(d, 0);
    }
    if (rules.length !== targets[0]) failed = true;
    // These materials support the later local and structural relationships.
    for (const id of ["word", "code"])
      if (!accept(REGISTRY.get(id)!, 1)) failed = true;
    const allowed = (d: RuleDefinition) => {
      if (
        HEAVY_DIGIT_IDS.has(d.id) &&
        rules.filter((r) => HEAVY_DIGIT_IDS.has(r.definitionId)).length >= 2
      )
        return false;
      if (d.id.endsWith("-exact") && rules.some(isExactCount)) return false;
      const inventory = (family: string) =>
        family === "count" || family === "material-frequency";
      if (
        inventory(d.family) &&
        rules.filter((r) => inventory(r.family)).length >= 3
      )
        return false;
      return (
        d.family === "composition" ||
        inventory(d.family) ||
        rules.filter((r) => r.family === d.family).length < 2
      );
    };
    for (const phase of [1, 2, 3, 4] as Phase[]) {
      let candidates = 0;
      const rejected = new Set<string>();
      while (
        rules.filter((r) => r.phase === phase).length < targets[phase] &&
        candidates < (fallback ? 32 : (options.candidateBudget ?? 32))
      ) {
        const pool = DEFINITIONS.filter(
          (d) =>
            d.phases.includes(phase) &&
            d.id !== "final-length" &&
            !used.has(d.id) &&
            allowed(d) &&
            // The final stage always opens with a relationship, never a stock count.
            (phase !== 4 ||
              rules.some((r) => r.phase === 4) ||
              d.family !== "count") &&
            !rejected.has(d.id) &&
            (!d.requires || d.requires.every((id) => used.has(id))),
        );
        if (!pool.length) break;
        const selected = fallback
          ? pool[0]
          : selection.weighted(pool, (d) => d.weight);
        candidates++;
        if (!accept(selected, phase)) rejected.add(selected.id);
      }
      // Targets are ceilings: a coherent shorter phase need not discard a valid plan.
      if (rules.filter((r) => r.phase === phase).length < (phase === 4 ? 1 : 3))
        failed = true;
    }
    if (rules.length < 15 || rules.length > 19) failed = true;
    if (failed) {
      trace.push({
        definition: "complete-plan",
        phase: 4,
        attempt: construction,
        accepted: false,
        reason: "阶段数量或完整长度未满足",
      });
      continue;
    }
    // Re-run all prefixes and certificates independently from construction.
    for (let i = 0; i < rules.length; i++) {
      if (!rules.slice(0, i + 1).every((r) => validateRule(r, wa).passed))
        throw new GenerationFailure(seed, trace);
      const ca = analyzePassword(contributions[i].counterexample);
      if (
        !ca.valid ||
        !rules.slice(0, i).every((r) => validateRule(r, ca).passed) ||
        validateRule(rules[i], ca).passed
      )
        throw new GenerationFailure(seed, trace);
    }
    const comments: GeneratedGame["plan"]["comments"] = [];
    const presentation = new SeededRandom(seed, "presentation");
    return {
      plan: {
        seed,
        version,
        rules,
        comments,
        presentation: {
          insertion: presentation.pick(["register", "amendment"]),
          closing: presentation.int(0, 1),
        },
      },
      witness: w.text,
      contributions,
      trace,
      context,
      fallback,
      attempts: construction + 1,
    };
  }
  throw new GenerationFailure(seed, trace);
}
