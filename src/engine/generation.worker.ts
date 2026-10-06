import { generateGame } from "./generator";
import { analyzePassword } from "./analyzer";
import { validateRule } from "../rules/validate";
import type { GeneratedGame } from "./types";
let cached: GeneratedGame | null = null;
self.onmessage = (
  event: MessageEvent<{
    kind: "generate" | "inspect";
    seed: string;
    version: string;
    sessionId: string;
  }>,
) => {
  const request = event.data;
  try {
    if (request.kind === "inspect") {
      if (
        !cached ||
        cached.plan.seed !== request.seed ||
        cached.plan.version !== request.version
      )
        throw new Error("No matching session");
      const a = analyzePassword(cached.witness);
      const prefixesValid =
        a.valid &&
        cached.plan.rules.every((_, i) =>
          cached!.plan.rules
            .slice(0, i + 1)
            .every((r) => validateRule(r, a).passed),
        );
      const certificatesValid =
        cached.contributions.length === cached.plan.rules.length &&
        cached.contributions.every((proof, i) => {
          const negative = analyzePassword(proof.counterexample);
          return (
            negative.valid &&
            cached!.plan.rules
              .slice(0, i)
              .every((r) => validateRule(r, negative).passed) &&
            !validateRule(cached!.plan.rules[i], negative).passed
          );
        });
      self.postMessage({
        type: "debug",
        sessionId: request.sessionId,
        generated: cached,
        verification: { prefixesValid, certificatesValid },
      });
      return;
    }
    cached = generateGame(request.seed, request.version);
    self.postMessage({
      type: "ready",
      sessionId: request.sessionId,
      plan: cached.plan,
    });
  } catch {
    self.postMessage({
      type: "error",
      kind: request.kind,
      sessionId: request.sessionId,
      message: "这次加载失败了，请重试。",
    });
  }
};
