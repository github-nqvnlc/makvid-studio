import { desc, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { projects, withWorkspace } from "@makvid/db";
import { Link } from "@/i18n/navigation";
import { server } from "@/server/deps";
import { viewer } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const v = await viewer();
  if (!v)
    return (
      <section className="card stack" style={{ maxWidth: 640 }}>
        <h1>{t("app.name")}</h1>
        <p>{t("app.tagline")}</p>
        <div className="row">
          <Link className="btn primary" href="/sign-up">
            {t("nav.signUp")}
          </Link>
          <Link className="btn" href="/sign-in">
            {t("nav.signIn")}
          </Link>
        </div>
      </section>
    );
  const rows = await withWorkspace(server().db, v.workspaceId, (tx) =>
    tx
      .select({ id: projects.id, title: projects.title, status: projects.status })
      .from(projects)
      .where(isNull(projects.deletedAt))
      .orderBy(desc(projects.updatedAt)),
  );
  return (
    <section className="stack">
      <div className="row">
        <h1 style={{ marginRight: "auto" }}>{t("projects.title")}</h1>
        <Link className="btn primary" href="/projects/new">
          {t("nav.newProject")}
        </Link>
      </div>
      <div className="card">
        {rows.length === 0 ? (
          <p className="muted">{t("projects.empty")}</p>
        ) : (
          <ul className="list" data-testid="project-list">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>{p.title}</Link>
                <span className={`badge${p.status === "ready" ? " ok" : ""}`}>{t(`status.${p.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
