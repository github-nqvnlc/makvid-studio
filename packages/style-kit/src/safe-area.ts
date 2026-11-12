// Safe areas per aspect as fractions of the frame. 9:16 reserves the zones covered by
// TikTok / Reels / Shorts UI (top bar, bottom caption + buttons, right action rail).
export type Aspect = "16:9" | "9:16" | "1:1" | "4:5";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const SAFE_AREAS: Record<Aspect, Insets> = {
  "16:9": { top: 0.06, right: 0.06, bottom: 0.08, left: 0.06 },
  "9:16": { top: 0.1, right: 0.14, bottom: 0.2, left: 0.06 },
  "1:1": { top: 0.07, right: 0.07, bottom: 0.1, left: 0.07 },
  "4:5": { top: 0.07, right: 0.08, bottom: 0.13, left: 0.07 },
};

export const FRAME_SIZES: Record<Aspect, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/** Safe area in px; `override` comes from a style pack manifest (`safeArea`). */
export function safeAreaPx(
  aspect: Aspect,
  override?: Partial<Insets>,
): Insets & { width: number; height: number } {
  const { width, height } = FRAME_SIZES[aspect];
  const f = { ...SAFE_AREAS[aspect], ...override };
  const top = Math.round(f.top * height);
  const bottom = Math.round(f.bottom * height);
  const left = Math.round(f.left * width);
  const right = Math.round(f.right * width);
  return { top, right, bottom, left, width: width - left - right, height: height - top - bottom };
}

/** True when the rect lies fully inside the safe area (1 px tolerance). */
export function insideSafeArea(
  rect: { x: number; y: number; width: number; height: number },
  aspect: Aspect,
  override?: Partial<Insets>,
): boolean {
  const s = safeAreaPx(aspect, override);
  const { width, height } = FRAME_SIZES[aspect];
  return (
    rect.x >= s.left - 1 &&
    rect.y >= s.top - 1 &&
    rect.x + rect.width <= width - s.right + 1 &&
    rect.y + rect.height <= height - s.bottom + 1
  );
}
