import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Tests are node-only; Tailwind's PostCSS plugin is not loadable by Vite here.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["platform/**/*.test.ts", "apps/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@platform": path.resolve(__dirname, "platform"),
      "@apps": path.resolve(__dirname, "apps"),
      "@": path.resolve(__dirname, "src"),
    },
  },
});
