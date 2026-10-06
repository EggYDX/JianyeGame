import { CONTENT_VERSION } from "../src/data/materials";
import { chromium, firefox, webkit } from "@playwright/test";
import { platform, release, cpus, totalmem } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { generateGame } from "../src/engine/generator";
import { evaluateRules } from "../src/rules/definitions";
const versions: Record<string, string> = {};
for (const [name, engine, options] of [
  ["chrome", chromium, { channel: "chrome" }],
  ["edge", chromium, { channel: "msedge" }],
  ["firefox", firefox, {}],
  ["webkit", webkit, {}],
] as const) {
  const browser = await engine.launch(options);
  versions[name] = await browser.version();
  await browser.close();
}
const game = generateGame("registration"),
  times: number[] = [];
for (let i = 0; i < 100; i++) {
  const raw = "A9!鱼".repeat(63) + String(i).padStart(4, "0");
  const start = performance.now();
  evaluateRules(game.plan.rules, raw);
  times.push(performance.now() - start);
}
times.sort((a, b) => a - b);
mkdirSync("reports", { recursive: true });
writeFileSync(
  `reports/environment-v${CONTENT_VERSION}.json`,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      platform: platform(),
      os: release(),
      cpu: cpus()[0].model,
      logicalCores: cpus().length,
      ramGiB: Math.round(totalmem() / 2 ** 30),
      node: process.version,
      browsers: versions,
      validation: {
        runtime: "Node (pure engine)",
        inputGraphemes: 256,
        rules: game.plan.rules.length,
        samples: 100,
        p95Ms: times[94],
        maxMs: times[99],
      },
    },
    null,
    2,
  ),
);
