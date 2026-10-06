import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { CONTENT_VERSION } from "../src/data/materials";
import { NEW_CHALLENGE_IDS } from "../src/rules/definitions";
import corpus from "../tests/corpus.json";
import regressions from "../tests/regressions.json";
import { generateGame } from "../src/engine/generator";
import { analyzePassword } from "../src/engine/analyzer";
import { validateRule } from "../src/rules/validate";
import type { GeneratedGame } from "../src/engine/types";

const size = Number(process.argv[2] ?? 12),
  explore = process.argv.includes("--explore");
if (![12, 50, 200].includes(size) || (explore && size !== 12))
  throw new Error(
    "Only fixed tiers 12 / 50 / 200 are allowed. Exploration is limited to 12.",
  );
const historic = (regressions as { seed: string; issue: string }[]).map(
  (r) => r.seed,
);
const available = [...new Set([...historic, ...corpus])];
const batchArg = process.argv.find((a) => a.startsWith("--batch="));
const batch = batchArg ? Number(batchArg.split("=")[1]) : 0;
if (!Number.isInteger(batch) || batch < 0 || (explore && batchArg))
  throw new Error("Invalid fixed batch.");
const seeds = explore
  ? Array.from({ length: 12 }, () => randomBytes(8).toString("hex"))
  : available.slice(batch * size, (batch + 1) * size);
if (!seeds.length) throw new Error("Requested corpus batch is empty.");
const scope = {
  mode: explore ? "exploration" : "fixed",
  batch,
  total: seeds.length,
  limit: size,
  available: available.length,
  batches: Math.ceil(available.length / size),
  seeds,
};
if (process.argv.includes("--list")) {
  console.log(JSON.stringify(scope, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({ ...scope, seeds: undefined }));
const start = performance.now();
let fallback = 0,
  completed = 0;
const families: Record<string, number> = {},
  combinations = new Set<string>(),
  cases: {
    seed: string;
    ms: number;
    rules: number;
    attempts: number;
    initialMinimum: number;
    witnessLength: number;
    newChallenges: string[];
  }[] = [];
mkdirSync("reports", { recursive: true });
for (const seed of seeds) {
  if (performance.now() - start > 60000) {
    writeFileSync(
      "reports/generation.json",
      JSON.stringify({ status: "INCOMPLETE", completed, total: size }, null, 2),
    );
    throw new Error("60-second budget reached; NOT a passing result.");
  }
  let generated: GeneratedGame | undefined;
  try {
    const t = performance.now();
    generated = generateGame(seed);
    const a = analyzePassword(generated.witness);
    generated.plan.rules.forEach((r, i) => {
      if (
        !generated!.plan.rules
          .slice(0, i + 1)
          .every((rule) => validateRule(rule, a).passed)
      )
        throw new Error(`Witness failed at ${r.id}`);
      const negative = analyzePassword(
        generated!.contributions[i].counterexample,
      );
      if (
        !negative.valid ||
        !generated!.plan.rules
          .slice(0, i)
          .every((rule) => validateRule(rule, negative).passed) ||
        validateRule(r, negative).passed
      )
        throw new Error(`Contribution failed at ${r.id}`);
      families[r.family] = (families[r.family] ?? 0) + 1;
    });
    cases.push({
      seed,
      ms: performance.now() - t,
      rules: generated.plan.rules.length,
      attempts: generated.attempts,
      initialMinimum:
        generated.plan.rules[0].predicate.kind === "length"
          ? generated.plan.rules[0].predicate.value
          : -1,
      witnessLength: a.graphemes.length,
      newChallenges: generated.plan.rules
        .filter((r) => NEW_CHALLENGE_IDS.has(r.definitionId))
        .map((r) => r.definitionId),
    });
    combinations.add(generated.plan.rules.map((r) => r.definitionId).join(","));
    if (generated.fallback) fallback++;
    completed++;
    if (completed % 10 === 0 || completed === seeds.length)
      console.log(
        JSON.stringify({
          completed,
          total: seeds.length,
          elapsedMs: Math.round(performance.now() - start),
          failures: 0,
          fallback,
        }),
      );
  } catch (error) {
    writeFileSync(
      "reports/generation-failure.json",
      JSON.stringify(
        {
          seed,
          version: CONTENT_VERSION,
          error: String(error),
          diagnostic: generated ?? error,
        },
        null,
        2,
      ),
    );
    console.error(`FAILED seed=${seed}; reports/generation-failure.json`);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) {
  const sorted = cases.map((c) => c.ms).sort((a, b) => a - b);
  if (performance.now() - start > 60000) {
    writeFileSync(
      "reports/generation.json",
      JSON.stringify(
        {
          status: "INCOMPLETE",
          completed,
          elapsedMs: performance.now() - start,
        },
        null,
        2,
      ),
    );
    throw new Error("60-second budget exceeded; NOT a passing result.");
  }
  const report = {
    status: "PASS",
    version: CONTENT_VERSION,
    corpus: explore ? "optional-exploration" : "fixed-v1",
    batch,
    available: available.length,
    total: completed,
    fallback,
    uniqueCombinations: combinations.size,
    families,
    elapsedMs: performance.now() - start,
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs: sorted.at(-1),
    cases,
  };
  writeFileSync(
    `reports/generation${explore ? "-exploration" : ""}.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      status: report.status,
      p95Ms: Math.round(report.p95Ms),
      maxMs: Math.round(report.maxMs!),
      uniqueCombinations: combinations.size,
      fallback,
    }),
  );
}
