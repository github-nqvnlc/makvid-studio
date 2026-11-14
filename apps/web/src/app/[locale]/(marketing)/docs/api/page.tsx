// Generated API docs (US7, T148): rendered from the OpenAPI contract, so the page never drifts from the API.
import { setRequestLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { openApiDoc, type Operation } from "@/server/openapi";

export const dynamic = "force-dynamic";

const METHODS = ["get", "post", "put", "patch", "delete"] as const;

function schemaName(s: unknown): string {
  const ref = (s as { $ref?: string } | undefined)?.$ref;
  return ref ? ref.split("/").pop()! : s ? "object" : "";
}

function Op({ method, path, op }: { method: string; path: string; op: Operation }) {
  const body = op.requestBody?.content ? Object.entries(op.requestBody.content) : [];
  return (
    <article className="bg-card flex flex-col gap-2 rounded-lg border p-4" id={`${method}-${path}`}>
      <h3 className="text-sm font-semibold">
        <code>
          {method.toUpperCase()} /api/v1{path}
        </code>
      </h3>
      {op.summary && <p>{op.summary}</p>}
      {op.description && <p className="text-muted-foreground text-sm">{op.description}</p>}
      {!!op.parameters?.length && (
        <p className="text-sm">
          Parameters:{" "}
          {op.parameters
            .map((p) =>
              p.$ref ? p.$ref.split("/").pop() : `${p.name} (${p.in}${p.required ? ", required" : ""})`,
            )
            .join(" · ")}
        </p>
      )}
      {body.map(([type, c]) => (
        <p key={type} className="text-sm">
          Body: <code>{type}</code>{" "}
          {schemaName(c.schema) && <a className="underline underline-offset-4" href={`#schema-${schemaName(c.schema)}`}>{schemaName(c.schema)}</a>}
        </p>
      ))}
      {op.responses && (
        <p className="text-sm">
          Responses:{" "}
          {Object.entries(op.responses)
            .map(([code, r]) => `${code} ${r.description ?? r.$ref?.split("/").pop() ?? ""}`)
            .join(" · ")}
        </p>
      )}
    </article>
  );
}

export default async function ApiDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const doc = openApiDoc();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10 md:px-6">
      <div className="flex flex-col gap-4" data-testid="api-docs">
        <h1 className="text-3xl font-bold tracking-tight">
          {doc.info.title} <Badge variant="secondary">v{doc.info.version}</Badge>
        </h1>
        {doc.info.description && <p>{doc.info.description}</p>}
        <p className="text-sm">
          <a className="underline underline-offset-4" href="/api/v1/openapi.yaml">openapi.yaml</a>
        </p>
        <h2 className="mt-4 text-xl font-semibold">Endpoints</h2>
        {Object.entries(doc.paths).flatMap(([path, item]) =>
          METHODS.filter((m) => item[m]).map((m) => (
            <Op key={`${m} ${path}`} method={m} path={path} op={item[m]!} />
          )),
        )}
        <h2 className="mt-4 text-xl font-semibold">Webhooks</h2>
        {Object.entries(doc.webhooks ?? {}).flatMap(([name, item]) =>
          METHODS.filter((m) => item[m]).map((m) => (
            <Op key={name} method={m} path={` → your URL (${name})`} op={item[m]!} />
          )),
        )}
        <h2 className="mt-4 text-xl font-semibold">Schemas</h2>
        {Object.entries(doc.components.schemas).map(([name, s]) => (
          <details key={name} id={`schema-${name}`} className="bg-card rounded-lg border p-4">
            <summary>
              <code>{name}</code>
            </summary>
            <pre className="text-sm">{JSON.stringify(s, null, 2)}</pre>
          </details>
        ))}
      </div>
    </div>
  );
}
