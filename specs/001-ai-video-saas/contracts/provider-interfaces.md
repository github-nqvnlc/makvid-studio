# Contract: Interface nội bộ thay thế được

Mọi nhà cung cấp bên ngoài và engine đi qua các interface dưới đây (nguyên tắc VIII). Đây là hình
dạng dự kiến, chữ ký cuối cùng nằm trong package tương ứng.

```ts
// packages/renderer
interface Renderer {
  readonly id: "hyperframes" | "fallback";
  readonly version: string;
  renderScene(
    input: {
      sceneDir: string; // HTML + asset đã compile, không có URL ngoài
      width: number;
      height: number;
      fps: number | { num: number; den: number };
      frameRange?: [start: number, endExclusive: number]; // render theo chunk
      outPath: string;
      signal?: AbortSignal;
    },
    onProgress?: (p: { framesDone: number; framesTotal: number }) => void,
  ): Promise<RenderResult>;
  captureFrames(input: {
    sceneDir: string;
    width: number;
    height: number;
    atMs: number[];
  }): Promise<Array<{ atMs: number; png: Buffer; dom?: DomMetrics }>>; // cho QA
}
interface RenderResult {
  outPath: string;
  frames: number;
  durationMs: number;
  frameHashes?: string[];
}

// packages/ai — mọi provider qua OpenAI SDK (baseURL + apiKey + model)
interface LlmProvider {
  complete<T>(req: {
    step: PipelineStep;
    messages: ChatMessage[];
    schema?: ZodType<T>;
    images?: Buffer[];
  }): Promise<{ output: T; usage: TokenUsage }>;
}

// packages/tts
interface TtsProvider {
  readonly id: string;
  listVoices(): Promise<Voice[]>;
  synthesize(req: {
    text: string;
    voiceId: string;
    speed?: number;
  }): Promise<{ audio: Buffer; mime: string; words?: Word[]; chars: number; costUsd: number }>;
}
interface Aligner {
  align(req: { audio: Buffer; transcript?: string; language: "vi" }): Promise<{ words: Word[] }>;
}

// packages/media
interface MediaGenProvider {
  generateImage(req: {
    prompt: string;
    width: number;
    height: number;
    seed: number;
  }): Promise<{ image: Buffer; costUsd: number }>;
  generateVideo?(req: {
    prompt: string;
    durationSec: number;
    seed: number;
  }): Promise<{ video: Buffer; costUsd: number }>;
}

// packages/billing
interface PaymentProvider {
  readonly id: "polar" | "lemonsqueezy" | "paddle" | "payos" | "vnpay" | "momo";
  createCheckout(req: {
    workspaceId: string;
    planId?: string;
    creditPackId?: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  parseWebhook(req: { headers: Headers; rawBody: string }): Promise<PaymentEvent>; // verify chữ ký
  cancelSubscription(ref: string): Promise<void>;
}

// packages/storage
interface ObjectStore {
  put(key: string, body: Buffer | Readable, mime: string): Promise<void>;
  get(key: string): Promise<Readable>;
  signedUrl(key: string, ttlSec: number): Promise<string>;
  delete(key: string): Promise<void>;
}
```

Mỗi implementation có contract test dùng chung (cùng bộ test chạy cho HyperFrames và Fallback,
cho mock và provider thật ở chế độ ghi fixture).
