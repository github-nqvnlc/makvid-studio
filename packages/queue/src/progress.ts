// Progress events (T084): workers report {key, params, fraction}; clients turn the key into a friendly
// Vietnamese / English sentence ("Đang dựng cảnh 4/9"). Keys and texts live with the pipeline
// (@makvid/pipeline messages) so no technology or provider name ever reaches the user.
export interface ProgressEvent {
  projectId: string;
  stage: string;
  key: string;
  params?: Record<string, string | number>;
  fraction: number; // 0..1 overall
  at: string; // ISO time
}

export function progressEvent(
  projectId: string,
  stage: string,
  p: { key: string; params?: Record<string, string | number>; fraction: number },
): ProgressEvent {
  return {
    projectId,
    stage,
    key: p.key,
    ...(p.params ? { params: p.params } : {}),
    fraction: Math.max(0, Math.min(1, p.fraction)),
    at: new Date().toISOString(),
  };
}
