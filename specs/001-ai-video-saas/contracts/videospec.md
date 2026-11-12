# Contract: VideoSpec (bản nháp `specVersion: "0.1.0"`)

Nguồn sự thật duy nhất của một video. Định nghĩa chính thức sẽ là zod schema trong `packages/spec`.
Đây là hình dạng dự kiến (TypeScript-like), chưa phải code.

```ts
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5";

interface VideoSpec {
  specVersion: string; // semver; migration tuần tự khi tăng
  meta: {
    language: "vi"; // bản đầu chỉ "vi" (Clarification Q1)
    aspectRatios: AspectRatio[]; // xuất nhiều tỷ lệ một lần
    fps: 30 | 60; // 60 để sẵn
    resolution: "1080p" | "2160p"; // 2160p để sẵn
    primaryStyleId: string; // quy định font phụ đề + logo
    brandKitId?: string;
    voice: { voiceId: string; speed?: number } | { recordingAssetId: string };
    music?: { trackId?: string; assetId?: string; volumeDb?: number; mood?: string };
    targetDurationSec: number; // 30..600
    seed: number; // seed PRNG toàn video
    watermark?: boolean; // do hệ thống bật theo gói, không do AI
  };
  script: Array<{ id: string; text: string }>; // đoạn lời đọc, NFC
  scenes: Scene[];
  audio: {
    narration?: { assetKey: string; words: Word[] }; // sau bước tts/align
    sfx: Array<{ sfxId: string; atMs: number; gainDb?: number }>;
    ducking: { enabled: boolean; reductionDb: number };
    loudnessTargetLufs: number; // mặc định -14
  };
  captions: { enabled: boolean; styleId?: string; maxLines: 1 | 2 };
  variables: Record<string, { type: "text" | "image" | "number"; value?: unknown }>;
}

interface Scene {
  id: string; // ổn định qua các phiên bản (patch nhắm theo id)
  styleId: string;
  templateId: string | "freeform";
  slots: Record<string, SlotValue>; // theo schema của template
  freeform?: { html: string; css: string; js: string }; // chỉ khi templateId = "freeform"
  scriptRefs: string[]; // id đoạn script
  assets: string[]; // asset ids
  transitionIn?: { presetId: string; durationMs: number };
  tuning?: { speed?: number; accentColor?: string; emphasisWords?: string[] };
  timing?: { startMs: number; durationMs: number }; // điền sau bước audio
}

type SlotValue =
  | string
  | number
  | { assetId: string }
  | { series: Array<{ label: string; value: number }> }
  | { var: string }; // tham chiếu biến template "{{name}}"

interface Word {
  text: string;
  startMs: number;
  endMs: number;
  scriptId: string;
}
```

## Patch

- Mỗi lần sửa bằng chat là một **RFC 6902 JSON Patch** nhắm theo đường dẫn có `scenes/{index}`,
  được resolve từ `scene.id` lúc tạo patch.
- Sau khi áp patch: spec phải qua zod parse, bước compile kiểm slot và bước QA. Nếu fail thì không
  tạo version, và AI giải thích hoặc hỏi lại.
- Tập cảnh bị ảnh hưởng = cảnh có path bị chạm + cảnh lân cận nếu `transitionIn`/`timing` đổi +
  toàn bộ nếu `meta.voice`/`script` đổi (phải chạy lại audio).

## Bất biến

- Mọi text ở dạng NFC. `scene.id` duy nhất trong một spec. `scriptRefs` trỏ tới id tồn tại.
- Cùng spec + cùng style pack version + cùng engine version → cùng HTML → cùng frame.
