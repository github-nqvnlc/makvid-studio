"use client";
import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Breadcrumbs() {
  const t = useTranslations("shell");
  const tn = useTranslations("nav");
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  const name = (seg: string, i: number): string => {
    if (UUID.test(seg)) return t("crumbs.detail");
    if (seg === "new") return t("crumbs.new");
    if (seg === "workspace") return t("crumbs.workspace");
    if (seg === "account") return t("crumbs.account");
    if (seg === "projects") return tn("projects");
    if (seg === "batches") return tn("batches");
    if (seg === "brand" || seg === "assets" || seg === "members" || seg === "billing" || seg === "api" || seg === "admin")
      return tn(seg);
    return parts[i] ?? seg;
  };

  const root = parts[0] === "projects" || parts[0] === "batches" ? [] : [{ href: "/", label: tn("projects") }];
  const crumbs = root.concat(
    parts.map((seg, i) => ({ href: `/${parts.slice(0, i + 1).join("/")}`, label: name(seg, i) })),
  );
  // "/" alone: just the first crumb as the page.
  const list = parts.length === 0 ? crumbs.slice(0, 1) : crumbs;
  const hrefFor = (href: string) => (href === "/workspace" ? "/workspace/brand" : href);

  return (
    <Breadcrumb aria-label={t("breadcrumb")}>
      <BreadcrumbList className="flex-nowrap">
        {list.map((c, i) => (
          <Fragment key={c.href}>
            {i > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem className="min-w-0">
              {i === list.length - 1 ? (
                <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={hrefFor(c.href) as "/"}>{c.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
