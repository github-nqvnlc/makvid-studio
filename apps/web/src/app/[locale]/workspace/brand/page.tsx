import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getBrandKit, listAssets } from "@/server/assets";
import { viewer } from "@/server/session";
import { BrandKitEditor, type KitValue } from "@/components/BrandKitEditor";

export const dynamic = "force-dynamic";

export default async function BrandPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const v = await viewer();
  if (!v) return redirect({ href: "/sign-in", locale });
  const kit = await getBrandKit(v.workspaceId);
  const initial: KitValue | null = kit
    ? {
        name: kit.name,
        colors: kit.colors as Record<string, string>,
        logoAssetId: kit.logoAssetId,
        logoPosition: kit.logoPosition === "top-left" ? "top-left" : "top-right",
        fonts: kit.fonts as KitValue["fonts"],
      }
    : null;
  return <BrandKitEditor initial={initial} assets={await listAssets(v.workspaceId, ["image", "font"])} />;
}
