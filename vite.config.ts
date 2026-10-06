import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { workerSource } from "./scripts/worker-source";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "inline-worker-dev",
      resolveId(id) {
        if (id === "virtual:generation-worker") return "\0generation-worker";
      },
      async load(id) {
        if (id === "\0generation-worker")
          return `export default ${JSON.stringify(await workerSource(true))}`;
      },
      handleHotUpdate(context) {
        if (
          /\/src\/(engine|rules|data|copy)\//.test(
            context.file.replaceAll("\\", "/"),
          )
        ) {
          const module = context.server.moduleGraph.getModuleById(
            "\0generation-worker",
          );
          if (module) context.server.moduleGraph.invalidateModule(module);
          context.server.ws.send({ type: "full-reload" });
          return [];
        }
      },
    },
  ],
  base: "./",
  build: { target: "es2022" },
});
