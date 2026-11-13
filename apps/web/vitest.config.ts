import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import { sharedTest } from "@makvid/config/vitest";

export default defineConfig({
  test: { ...sharedTest, include: ["test/**/*.test.ts"] },
  resolve: {
    alias: {
      "server-only": resolve(import.meta.dirname, "test/server-only-stub.ts"),
      "@": resolve(import.meta.dirname, "src"),
    },
  },
});
