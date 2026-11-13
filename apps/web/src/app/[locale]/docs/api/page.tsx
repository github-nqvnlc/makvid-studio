// Generated API docs (US7, T148): rendered from the OpenAPI contract, so the page never drifts from the API.
import { setRequestLocale } from "next-intl/server";
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
    <article className="card stack" id={`${method}-${path}`}>
      <h3>
        <code>
          {method.toUpperCase()} /api/v1{path}
        </code>
      </h3>
      {op.summary && <p>{op.summary}</p>}
      {op.description && <p className="small muted">{op.description}</p>}
      {!!op.parameters?.length && (
        <p className="small">
          Parameters:{" "}
          {op.parameters
            .map((p) =>
              p.$ref ? p.$ref.split("/").pop() : `${p.name} (${p.in}${p.required ? ", required" : ""})`,
            )
            .join(" · ")}
        </p>
      )}
      {body.map(([type, c]) => (
        <p key={type} className="small">
          Body: <code>{type}</code>{" "}
          {schemaName(c.schema) && <a href={`#schema-${schemaName(c.schema)}`}>{schemaName(c.schema)}</a>}
        </p>
      ))}
      {op.responses && (
        <p className="small">
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
    <div className="stack" data-testid="api-docs">
      <h1>
        {doc.info.title} <span className="badge">v{doc.info.version}</span>
      </h1>
      {doc.info.description && <p>{doc.info.description}</p>}
      <p className="small">
        <a href="/api/v1/openapi.yaml">openapi.yaml</a>
      </p>
      <h2>Endpoints</h2>
      {Object.entries(doc.paths).flatMap(([path, item]) =>
        METHODS.filter((m) => item[m]).map((m) => (
          <Op key={`${m} ${path}`} method={m} path={path} op={item[m]!} />
        )),
      )}
      <h2>Webhooks</h2>
      {Object.entries(doc.webhooks ?? {}).flatMap(([name, item]) =>
        METHODS.filter((m) => item[m]).map((m) => (
          <Op key={name} method={m} path={` → your URL (${name})`} op={item[m]!} />
        )),
      )}
      <h2>Schemas</h2>
      {Object.entries(doc.components.schemas).map(([name, s]) => (
        <details key={name} id={`schema-${name}`} className="card">
          <summary>
            <code>{name}</code>
          </summary>
          <pre className="small">{JSON.stringify(s, null, 2)}</pre>
        </details>
      ))}
    </div>
  );
}
