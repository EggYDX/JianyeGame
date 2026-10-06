import { CONTENT_VERSION } from "../data/materials";
import {
  DEFINITIONS,
  REGISTRY,
  NEW_CHALLENGE_IDS,
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
    for (const id of [
      "minimum",
      "basic-digit",
      "basic-upper",
      "basic-punctuation",
    ])
      if (!accept(REGISTRY.get(id)!, 0)) failed = true;
    const budgets = [
      0,
      structure.int(7, 9),
      structure.int(8, 10),
      structure.int(10, 13),
      structure.int(6, 8),
    ];
    const newCount = () =>
      rules.filter((r) => NEW_CHALLENGE_IDS.has(r.definitionId)).length;
    const additionTarget = structure.int(2, 3);
    for (const phase of [1, 2, 3, 4] as Phase[]) {
      let spent = 0,
        candidates = 0;
      const rejected = new Set<string>();
      while (
        spent < budgets[phase] &&
        rules.length < 23 &&
        candidates < (fallback ? 32 : (options.candidateBudget ?? 32))
      ) {
        const pool = DEFINITIONS.filter(
          (d) =>
            d.phases.includes(phase) &&
            d.id !== "final-length" &&
            !used.has(d.id) &&
            (!NEW_CHALLENGE_IDS.has(d.id) ||
              newCount() < Math.min(phase, additionTarget)) &&
            !rejected.has(d.id) &&
            (!d.requires || d.requires.every((id) => used.has(id))),
        );
        if (!pool.length) break;
        // Reserve one approachable addition in each of the first two middle stages.
        const additions = pool.filter((d) => NEW_CHALLENGE_IDS.has(d.id));
        const choices =
          phase <= 3 &&
          newCount() < Math.min(phase, additionTarget) &&
          additions.length
            ? additions
            : pool;
        const selected = fallback
          ? choices[0]
          : selection.weighted(choices, (d) => d.weight);
        candidates++;
        if (accept(selected, phase)) spent += selected.difficulty;
        else rejected.add(selected.id);
      }
      if (spent < (phase === 3 ? 6 : phase === 4 ? 4 : 5)) failed = true;
    }
    if (!accept(REGISTRY.get("final-length")!, 4)) failed = true;
    if (rules.length < 18 || rules.length > 24) failed = true;
    if (newCount() !== additionTarget) failed = true;
    if (failed) {
      trace.push({
        definition: "complete-plan",
        phase: 4,
        attempt: construction,
        accepted: false,
        reason: "阶段预算或完整长度未满足",
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
