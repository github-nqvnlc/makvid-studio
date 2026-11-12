import { describe, expect, it } from "vitest";
import { assertKey, createObjectStore, workspaceKey } from "../src";

describe("keys", () => {
  it("scopes keys by workspace and rejects traversal", () => {
    expect(workspaceKey("ws_1", "renders", "a.mp4")).toBe("ws/ws_1/renders/a.mp4");
    expect(() => workspaceKey("../x", "a")).toThrow();
    expect(() => assertKey("ws/a/../b")).toThrow();
    expect(() => assertKey("/abs")).toThrow();
  });
});

// Integration against SeaweedFS from docker/compose.dev.yml: MAKVID_INFRA_TESTS=1
describe.runIf(process.env.MAKVID_INFRA_TESTS === "1")("ObjectStore on SeaweedFS (S3 API)", () => {
  const store = createObjectStore({
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:8333",
    region: "us-east-1",
    bucket: "makvid-test",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "makvid-dev-access",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "makvid-dev-secret-change-me",
    forcePathStyle: true,
  });

  it("put / get / exists / signed URL / delete", async () => {
    await store.ensureBucket();
    const key = workspaceKey("ws_test", "hello-vi.txt");
    await store.put(key, "Xin chào Ẩn Ỹ Ự", { contentType: "text/plain; charset=utf-8" });
    expect((await store.get(key)).toString("utf8")).toBe("Xin chào Ẩn Ỹ Ự");
    expect(await store.exists(key)).toBe(true);
    const url = await store.signedGetUrl(key, 60);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Xin chào Ẩn Ỹ Ự");
    await store.delete(key);
    expect(await store.exists(key)).toBe(false);
  });
});
