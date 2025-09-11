import { defineConfig } from "vite";
import honoViteBuild from "@hono/vite-build";

export default defineConfig({
  plugins: [
    honoViteBuild({
      entry: "src/index.tsx",
     }),
  ],
  build: {
    target: "esnext",
    outDir: "dist",
    rollupOptions: {
      input: "src/index.tsx",
    },
  },
});
