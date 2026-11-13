// ObjectStore over the S3 API (AWS SDK v3). Works with SeaweedFS (dev/self-host), Cloudflare R2 and
// AWS S3 by configuration only. Keys are always workspace-scoped by the caller (ws/<workspaceId>/...).
import { createReadStream, statSync } from "node:fs";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ObjectStoreConfig {
  endpoint?: string;
  /** Endpoint browsers use for signed URLs, when it differs from the one the server reaches (Docker). */
  publicEndpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}

export interface PutOptions {
  contentType?: string;
  cacheControl?: string;
}

export interface ObjectStore {
  put(key: string, body: Buffer | Uint8Array | string, opts?: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Upload a local file as a stream (large files: batch ZIPs). */
  putFile(key: string, path: string, opts?: PutOptions): Promise<void>;
  /** Download as a stream (large files). */
  getStream(key: string): Promise<NodeJS.ReadableStream>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** Time-limited download URL (default 15 min). */
  signedGetUrl(key: string, expiresInSec?: number): Promise<string>;
  /** Time-limited upload URL for direct browser uploads. */
  signedPutUrl(key: string, contentType: string, expiresInSec?: number): Promise<string>;
  ensureBucket(): Promise<void>;
}

/** Reject keys that could escape a prefix or confuse signing. */
export function assertKey(key: string): void {
  if (
    !key ||
    key.length > 1024 ||
    key.startsWith("/") ||
    key.split("/").some((p) => p === ".." || p === ".") ||
    [...key].some((c) => c.charCodeAt(0) < 0x20)
  )
    throw new Error(`invalid object key "${key}"`);
}

export function workspaceKey(workspaceId: string, ...parts: string[]): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId)) throw new Error("invalid workspace id");
  const key = ["ws", workspaceId, ...parts].join("/");
  assertKey(key);
  return key;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStoreConfig {
  const need = (k: string) => {
    const v = env[k];
    if (!v) throw new Error(`missing env ${k}`);
    return v;
  };
  return {
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_PUBLIC_ENDPOINT ? { publicEndpoint: env.S3_PUBLIC_ENDPOINT } : {}),
    region: env.S3_REGION ?? "us-east-1",
    bucket: need("S3_BUCKET"),
    accessKeyId: need("S3_ACCESS_KEY_ID"),
    secretAccessKey: need("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
  };
}

export function createObjectStore(cfg: ObjectStoreConfig): ObjectStore {
  const client = new S3Client({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
    forcePathStyle: cfg.forcePathStyle ?? false,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  // Signing needs no network call: a second client only changes the host in the signed URLs.
  const signer = cfg.publicEndpoint
    ? new S3Client({
        region: cfg.region,
        endpoint: cfg.publicEndpoint,
        forcePathStyle: cfg.forcePathStyle ?? false,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      })
    : client;
  const Bucket = cfg.bucket;
  return {
    async put(key, body, opts = {}) {
      assertKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: typeof body === "string" ? Buffer.from(body, "utf8") : body,
          ...(opts.contentType ? { ContentType: opts.contentType } : {}),
          ...(opts.cacheControl ? { CacheControl: opts.cacheControl } : {}),
        }),
      );
    },
    async putFile(key, path, opts = {}) {
      assertKey(key);
      await client.send(
        new PutObjectCommand({
          Bucket,
          Key: key,
          Body: createReadStream(path),
          ContentLength: statSync(path).size,
          ...(opts.contentType ? { ContentType: opts.contentType } : {}),
        }),
      );
    },
    async getStream(key) {
      assertKey(key);
      const r = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!r.Body) throw new Error(`empty object ${key}`);
      return r.Body as NodeJS.ReadableStream;
    },
    async get(key) {
      assertKey(key);
      const r = await client.send(new GetObjectCommand({ Bucket, Key: key }));
      if (!r.Body) throw new Error(`empty object ${key}`);
      return Buffer.from(await r.Body.transformToByteArray());
    },
    async exists(key) {
      assertKey(key);
      try {
        await client.send(new HeadObjectCommand({ Bucket, Key: key }));
        return true;
      } catch (e) {
        const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404 || (e as Error).name === "NotFound") return false;
        throw e;
      }
    },
    async delete(key) {
      assertKey(key);
      await client.send(new DeleteObjectCommand({ Bucket, Key: key }));
    },
    signedGetUrl(key, expiresInSec = 900) {
      assertKey(key);
      return getSignedUrl(signer, new GetObjectCommand({ Bucket, Key: key }), { expiresIn: expiresInSec });
    },
    signedPutUrl(key, contentType, expiresInSec = 900) {
      assertKey(key);
      return getSignedUrl(signer, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
        expiresIn: expiresInSec,
      });
    },
    async ensureBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket }));
      } catch {
        await client.send(new CreateBucketCommand({ Bucket }));
      }
    },
  };
}
