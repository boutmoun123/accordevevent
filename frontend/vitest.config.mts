import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: process.cwd(),
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    clearMocks: true,
  },
  resolve: { alias: { "@": path.dirname(fileURLToPath(import.meta.url)) } },
});
