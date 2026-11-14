"use client";
// Members and invitations.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { NativeSelect } from "@/components/common/NativeSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    toast.success(t("invited"));
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
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={t("title")} description={t("roleHelp")} />
      <Card>
        <CardContent>
          <ul className="divide-y" data-testid="members">
            {data.members.map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar className="size-9">
                  <AvatarFallback>{(m.name || m.email).slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">
                    {m.name || m.email} {m.userId === me && <span className="text-muted-foreground font-normal">({t("you")})</span>}
                  </div>
                  <div className="text-muted-foreground truncate text-xs">{m.email}</div>
                </div>
                {assignable.includes(m.role) && m.userId !== me ? (
                  <NativeSelect aria-label={m.email} value={m.role} onChange={(e) => void call(`/api/workspace/members/${m.userId}`, "PATCH", { role: e.target.value })}>
                    {assignable.map((r) => (
                      <option key={r} value={r}>
                        {t(`role.${r}`)}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge variant="secondary">{t(`role.${m.role}`)}</Badge>
                )}
                {m.role !== "owner" && (m.userId === me || assignable.includes(m.role)) && (
                  <Button variant="outline" size="sm" onClick={() => void call(`/api/workspace/members/${m.userId}`, "DELETE")}>
                    {m.userId === me ? t("leave") : t("remove")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {assignable.length > 0 && myRole !== "viewer" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("invite")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={(e) => void invite(e)} data-testid="invite-form">
              <div className="flex flex-wrap gap-2">
                <Input type="email" required placeholder={t("email")} aria-label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-56 flex-1" />
                <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label={t("roleLabel")}>
                  {assignable.map((r) => (
                    <option key={r} value={r}>
                      {t(`role.${r}`)}
                    </option>
                  ))}
                </NativeSelect>
                <Button type="submit">{t("send")}</Button>
              </div>
              {link && (
                <p className="text-sm">
                  {t("link")} <code className="bg-muted rounded px-1 font-mono text-xs break-all" data-testid="invite-link">{link}</code>
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {data.invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pending")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {data.invitations.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <Badge variant="secondary">{t(`role.${i.role}`)}</Badge>
                  {assignable.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => void call(`/api/workspace/invitations/${i.id}`, "DELETE")}>
                      {t("revoke")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
