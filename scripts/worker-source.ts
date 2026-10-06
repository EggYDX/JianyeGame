import { build } from "esbuild";
export async function workerSource(dev: boolean) {
  const r = await build({
    entryPoints: ["src/engine/generation.worker.ts"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    minify: !dev,
    define: { "import.meta.env.DEV": String(dev) },
  });
  return r.outputFiles[0].text;
}
