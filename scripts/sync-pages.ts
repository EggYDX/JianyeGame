import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
const project = process.cwd();
const output = resolve(project, "docs");
const assets = resolve(output, "assets");
if (
  dirname(output) !== project ||
  basename(output) !== "docs" ||
  dirname(assets) !== output
)
  throw new Error("Unexpected Pages output path");
if (!existsSync(resolve(project, "dist/index.html")))
  throw new Error("Run pnpm build first");
mkdirSync(output, { recursive: true });
rmSync(assets, { recursive: true, force: true });
cpSync(resolve(project, "dist/assets"), assets, { recursive: true });
cpSync(resolve(project, "dist/index.html"), resolve(output, "index.html"));
cpSync(resolve(project, "dist/licenses"), resolve(output, "licenses"), {
  recursive: true,
});
for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
  cpSync(resolve(project, "dist", file), resolve(output, file));
writeFileSync(resolve(output, ".nojekyll"), "");
console.log(
  "Pages files updated in docs/. Commit them together with the source changes.",
);
