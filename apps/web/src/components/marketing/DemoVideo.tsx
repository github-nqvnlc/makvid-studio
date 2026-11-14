"use client";
import { useEffect, useRef, useState } from "react";

/** Poster first. The video loads only when visible and the visitor has not asked for reduced motion. */
export function DemoVideo({ src, poster, label }: { src: string; poster: string | null; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setMotionOk(!m.matches);
    const on = () => setMotionOk(!m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || !motionOk) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) void v.play().catch(() => undefined);
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [motionOk]);

  return (
    <video
      ref={ref}
      className="size-full object-cover"
      src={motionOk ? src : undefined}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
    />
  );
}
