import { defineConfig } from "vitest/config"

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    // Asset preparation must not reload an in-progress browser test.
    hmr: process.env.FOREST_E2E === "1" ? false : undefined,
    watch: { ignored: ["**/test-results*/**", "**/playwright-report/**"] },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
})
