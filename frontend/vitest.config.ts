import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Some components import tarot.css; Vitest must not run Next's PostCSS
  // config (string-form plugins Vite can't load) on it
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
