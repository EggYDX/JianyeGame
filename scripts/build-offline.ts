import { build } from "esbuild";
import { mkdirSync, writeFileSync, rmSync, cpSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { workerSource } from "./worker-source";
const worker = await workerSource(false);
const output = resolve("dist");
if (dirname(output) !== process.cwd() || basename(output) !== "dist")
  throw new Error("Unexpected output directory");
rmSync(output, { recursive: true, force: true });
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  outfile: "dist/assets/app.js",
  format: "iife",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  assetNames: "fonts/[name]-[hash]",
  loader: { ".woff2": "file", ".woff": "file" },
  define: {
    "import.meta.env.DEV": "false",
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [
    {
      name: "inline-generation-worker",
      setup(b) {
        b.onResolve({ filter: /^virtual:generation-worker$/ }, () => ({
          path: "worker",
          namespace: "worker",
        }));
        b.onLoad({ filter: /.*/, namespace: "worker" }, () => ({
          contents: `export default ${JSON.stringify(worker)}`,
          loader: "js",
        }));
      },
    },
  ],
});
mkdirSync("dist", { recursive: true });
mkdirSync("dist/licenses", { recursive: true });
for (const file of [
  "react-LICENSE.txt",
  "react-dom-LICENSE.txt",
  "pure-rand-LICENSE.txt",
  "unicode-segmenter-LICENSE.txt",
  "fontsource-variable_noto-sans-sc-LICENSE.txt",
])
  cpSync(`licenses/${file}`, `dist/licenses/${file}`);
for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
  cpSync(file, `dist/${file}`);
writeFileSync(
  "dist/index.html",
  '<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#fcfcfd"><title>间页</title><link rel="stylesheet" href="./assets/app.css"><script defer src="./assets/app.js"></script></head><body><div id="root"></div></body></html>\n',
);
console.log(
  "Offline build: dist/index.html — ordinary script + local assets + Blob Worker.",
);
