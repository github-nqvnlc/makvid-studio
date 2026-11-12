import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["visual/**/*.test.ts", "integration/**/*.test.ts"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    // Integration files render with Chrome + FFmpeg and run BullMQ workers; in parallel they starve each other.
    fileParallelism: false,
  },
});
