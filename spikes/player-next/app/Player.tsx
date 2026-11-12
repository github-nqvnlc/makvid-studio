"use client";
// M0 spike T005: embed <hyperframes-player> in a Next.js App Router client component.
import { useEffect, useRef, useState } from "react";

type PlayerEl = HTMLElement & { seek(t: number): void; play(): void; pause(): void; currentTime: number; duration: number };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React.JSX {
    interface IntrinsicElements {
      "hyperframes-player": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string; "runtime-src"?: string; controls?: boolean; width?: number; height?: number;
      };
    }
  }
}

export default function Player({ src, width, height }: { src: string; width: number; height: number }) {
  const ref = useRef<PlayerEl>(null);
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("@hyperframes/player").then(() => {
      if (cancelled) return;
      const el = ref.current;
      if (!el) return;
      el.addEventListener("ready", () => setReady(true));
      el.addEventListener("timeupdate", () => setT(el.currentTime));
    });
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={{ width: width > height ? 800 : 360 }}>
      <hyperframes-player ref={ref} src={src} controls width={width} height={height} data-testid="player" />
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
        <button onClick={() => ref.current?.seek(7.5)}>Seek 7.5s</button>
        <button onClick={() => ref.current?.seek(3.5)}>Seek 3.5s</button>
        <span id="state">{ready ? "ready" : "loading"} · t={t.toFixed(2)}</span>
      </div>
    </div>
  );
}
