"use client";
// Members and invitations (US6, T142).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { apiError, postJson } from "@/lib/api-client";

type Role = "owner" | "admin" | "editor" | "viewer";
export interface MembersData {
  members: Array<{ userId: string; role: Role; email: string; name: string | null }>;
  invitations: Array<{ id: string; email: string; role: Role; expiresAt: string }>;
}

export function MembersPanel({
  data,
  me,
  myRole,
  assignable,
}: {
  data: MembersData;
  me: string;
  myRole: Role;
  assignable: Role[];
}) {
  const t = useTranslations("members");
  const te = useTranslations("errors");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(assignable[assignable.length - 1] ?? "viewer");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await postJson<{ link: string }>("/api/workspace/invitations", { email, role });
    if (!r.ok) return setError(te(r.error));
    setLink(r.data.link);
    setEmail("");
    router.refresh();
  }
  async function call(url: string, method: "PATCH" | "DELETE", body?: unknown) {
    setError(null);
    const res = await fetch(url, {
      method,
      ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) return setError(te(await apiError(res)));
    router.refresh();
  }

  return (
    <div className="stack">
      <h1>{t("title")}</h1>
      <p className="small muted">{t("roleHelp")}</p>
      <ul className="list card" data-testid="members">
        {data.members.map((m) => (
          <li key={m.userId} className="row">
            <span>
              {m.name || m.email} {m.userId === me && <span className="muted">({t("you")})</span>}
            </span>
            <span className="small muted">{m.email}</span>
            {assignable.includes(m.role) && m.userId !== me ? (
              <select
                aria-label={m.email}
                value={m.role}
                onChange={(e) =>
                  void call(`/api/workspace/members/${m.userId}`, "PATCH", { role: e.target.value })
                }
              >
                {assignable.map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}`)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="badge">{t(`role.${m.role}`)}</span>
            )}
            {m.role !== "owner" && (m.userId === me || assignable.includes(m.role)) && (
              <button
                className="btn"
                onClick={() => void call(`/api/workspace/members/${m.userId}`, "DELETE")}
              >
                {m.userId === me ? t("leave") : t("remove")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {assignable.length > 0 && myRole !== "viewer" && (
        <form className="card stack" onSubmit={(e) => void invite(e)} data-testid="invite-form">
          <h2>{t("invite")}</h2>
          <div className="row">
            <input
              type="email"
              required
              placeholder={t("email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="role">
              {assignable.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
            <button className="btn primary">{t("send")}</button>
          </div>
          {link && (
            <p className="small">
              {t("link")} <code data-testid="invite-link">{link}</code>
            </p>
          )}
        </form>
      )}
      {data.invitations.length > 0 && (
        <section className="card stack">
          <h2>{t("pending")}</h2>
          <ul className="list">
            {data.invitations.map((i) => (
              <li key={i.id} className="row">
                <span>{i.email}</span>
                <span className="badge">{t(`role.${i.role}`)}</span>
                {assignable.length > 0 && (
                  <button
                    className="btn"
                    onClick={() => void call(`/api/workspace/invitations/${i.id}`, "DELETE")}
                  >
                    {t("revoke")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
