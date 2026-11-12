// Test accounts for local / CI end-to-end runs (mock providers, localhost only). Not real credentials.
export const TEST_PASSWORD = "makvid-e2e-pass-1";
export const testEmail = (tag: string) => `e2e-${tag}-${Date.now()}@example.test`;
export const MANUAL_TEST_USER = {
  name: "Thử nghiệm",
  email: "manual-check@example.test",
  password: TEST_PASSWORD,
};
