import type { ReactNode } from "react";
import { viewer } from "@/server/session";
import { Footer } from "./Footer";
import { PublicHeader } from "./PublicHeader";

export async function MarketingShell({ children }: { children: ReactNode }) {
  const v = await viewer();
  return (
    <div className="bg-background text-foreground flex min-h-svh flex-col">
      <PublicHeader signedIn={!!v} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
