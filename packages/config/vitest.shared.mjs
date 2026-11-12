// Shared Vitest defaults for every package: node env, test/ folder, no watch in CI.
export const sharedTest = {
  environment: "node",
  include: ["test/**/*.test.ts"],
  testTimeout: 30_000,
};
