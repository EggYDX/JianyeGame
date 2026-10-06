// Run deliberately after a content version change, never from CI.
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateGame } from "../src/engine/generator";
import { CONTENT_VERSION } from "../src/data/materials";
const fixtures = Object.fromEntries(
  ["0", "137", "registration", "fallback"].map((seed) => [
    seed,
    createHash("sha256")
      .update(JSON.stringify(generateGame(seed).plan))
      .digest("hex"),
  ]),
);
writeFileSync(
  "tests/golden.json",
  JSON.stringify({ version: CONTENT_VERSION, fixtures }, null, 2) + "\n",
);
