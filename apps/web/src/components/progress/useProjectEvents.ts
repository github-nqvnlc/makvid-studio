"use client";
// Activity log of one project: newest history page first, then live entries over SSE. Entries are
// de-duplicated and ordered by `seq`, so a reconnect (which replays after Last-Event-ID) never repeats a line.
import { useCallback, useEffect, useRef, useState } from "react";

export type StageKey = "script" | "style" | "storyboard" | "audio" | "qa" | "render";
export type StageState = "waiting" | "running" | "needs_approval" | "done" | "failed";

export interface LogEntry {
  seq: number;
  at: string;
  stage: StageKey;
  kind: string;
  severity: "info" | "warning" | "error";
  text: string;
  fraction: number | null;
}
export interface StageInfo {
  stage: StageKey;
  state: StageState;
}
interface LogPage {
  entries: LogEntry[];
  stages: StageInfo[];
  nextAfter: number;
  hasMore: boolean;
}

const NEWEST = 2_000_000_000;

function merge(prev: LogEntry[], add: LogEntry[]): LogEntry[] {
  if (add.length === 0) return prev;
  const bySeq = new Map(prev.map((e) => [e.seq, e]));
  for (const e of add) bySeq.set(e.seq, e);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

export function useProjectEvents(projectId: string, locale: string) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [connection, setConnection] = useState<"live" | "reconnecting">("reconnecting");
  const [loaded, setLoaded] = useState(false);
  const first = useRef(0);

  useEffect(() => {
    let closed = false;
    let es: EventSource | null = null;
    const lang = locale === "en" ? "en" : "vi";
    (async () => {
      let after = 0;
      try {
        const res = await fetch(`/api/projects/${projectId}/log?locale=${lang}&before=${NEWEST}&limit=200`, {
          cache: "no-store",
        });
        if (res.ok) {
          const page = (await res.json()) as LogPage;
          if (closed) return;
          setEntries(page.entries);
          setStages(page.stages);
          setHasEarlier(page.hasMore);
          first.current = page.entries[0]?.seq ?? 0;
          after = page.nextAfter;
        }
      } catch {
        // the live stream below still delivers everything after seq 0
      }
      if (closed) return;
      setLoaded(true);
      es = new EventSource(`/api/projects/${projectId}/events?locale=${lang}&after=${after}`);
      es.onopen = () => setConnection("live");
      es.onerror = () => setConnection("reconnecting"); // EventSource retries by itself and resumes by Last-Event-ID
      es.addEventListener("log", (e) => {
        const entry = JSON.parse((e as MessageEvent<string>).data) as LogEntry;
        setEntries((p) => merge(p, [entry]));
      });
      es.addEventListener("stages", (e) => setStages(JSON.parse((e as MessageEvent<string>).data) as StageInfo[]));
    })();
    return () => {
      closed = true;
      es?.close();
    };
  }, [projectId, locale]);

  const loadEarlier = useCallback(async () => {
    const lang = locale === "en" ? "en" : "vi";
    const before = first.current;
    if (!before) return;
    const res = await fetch(`/api/projects/${projectId}/log?locale=${lang}&before=${before}&limit=200`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const page = (await res.json()) as LogPage;
    setEntries((p) => merge(p, page.entries));
    setHasEarlier(page.hasMore);
    first.current = page.entries[0]?.seq ?? before;
  }, [projectId, locale]);

  return { entries, stages, hasEarlier, loadEarlier, connection, loaded };
}
