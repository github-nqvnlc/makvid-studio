// Payment providers from env (ADR 0004). Keys live only in .env; nothing here is logged.
//   MAKVID_PAYMENTS = "off" | "mock" | "polar,payos" (any subset, comma separated)
import { MockPaymentProvider } from "./providers/mock";
import { PayOsProvider } from "./providers/payos";
import { PolarProvider } from "./providers/polar";
import type { PaymentProvider } from "./providers/types";

export interface Payments {
  providers: Partial<Record<PaymentProvider["id"], PaymentProvider>>;
  /** Polar product ids of the credit packs. */
  packProducts: Partial<Record<string, string>>;
}

export function paymentsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  baseUrl = env.APP_URL ?? "http://localhost:3000",
): Payments {
  const want = new Set((env.MAKVID_PAYMENTS ?? "off").split(",").map((s) => s.trim()));
  const providers: Payments["providers"] = {};
  // The mock provider grants plans without money: never in production.
  if (want.has("mock") && env.NODE_ENV === "production" && env.MAKVID_ALLOW_MOCK_PAYMENTS !== "1")
    throw new Error("MAKVID_PAYMENTS=mock is not allowed in production");
  if (want.has("mock"))
    providers.mock = new MockPaymentProvider(env.MAKVID_SECRET_KEY ?? "dev-mock-secret", baseUrl);
  if (want.has("polar") && env.POLAR_ACCESS_TOKEN && env.POLAR_WEBHOOK_SECRET)
    providers.polar = new PolarProvider({
      accessToken: env.POLAR_ACCESS_TOKEN,
      webhookSecret: env.POLAR_WEBHOOK_SECRET,
      server: env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
    });
  if (want.has("payos") && env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY)
    providers.payos = new PayOsProvider({
      clientId: env.PAYOS_CLIENT_ID,
      apiKey: env.PAYOS_API_KEY,
      checksumKey: env.PAYOS_CHECKSUM_KEY,
    });
  return {
    providers,
    packProducts: {
      ...(env.POLAR_PRODUCT_CREDITS_MIN30 ? { min30: env.POLAR_PRODUCT_CREDITS_MIN30 } : {}),
      ...(env.POLAR_PRODUCT_CREDITS_MIN120 ? { min120: env.POLAR_PRODUCT_CREDITS_MIN120 } : {}),
    },
  };
}
