// Friendly progress messages (T084). Keys are stable; text never names technologies or providers.
export const PROGRESS_MESSAGES: Record<"vi" | "en", Record<string, string>> = {
  vi: {
    "progress.ingest": "Đang đọc ý tưởng của bạn",
    "progress.script": "Đang viết lời đọc",
    "progress.style": "Đang chọn phong cách phù hợp",
    "progress.storyboard": "Đang phân cảnh",
    "progress.voice": "Đang tạo giọng đọc",
    "progress.mix": "Đang phối nhạc và giọng",
    "progress.qa": "Đang kiểm tra chất lượng hình ảnh",
    "progress.qaFix": "Đang tự sửa bố cục (lần {attempt})",
    "progress.render": "Đang dựng video",
    "progress.renderScene": "Đang dựng cảnh {current}/{total}",
    "progress.mux": "Đang hoàn thiện video",
    "progress.done": "Video đã sẵn sàng",
  },
  en: {
    "progress.ingest": "Reading your idea",
    "progress.script": "Writing the voice-over",
    "progress.style": "Choosing a matching style",
    "progress.storyboard": "Planning the scenes",
    "progress.voice": "Creating the voice",
    "progress.mix": "Mixing music and voice",
    "progress.qa": "Checking visual quality",
    "progress.qaFix": "Fixing the layout (attempt {attempt})",
    "progress.render": "Rendering the video",
    "progress.renderScene": "Rendering scene {current}/{total}",
    "progress.mux": "Finishing the video",
    "progress.done": "Your video is ready",
  },
};

export function progressText(
  key: string,
  params: Record<string, string | number> = {},
  locale: "vi" | "en" = "vi",
): string {
  const t = PROGRESS_MESSAGES[locale][key] ?? key;
  return t.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
}
