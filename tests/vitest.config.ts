import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["visual/**/*.test.ts", "integration/**/*.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
