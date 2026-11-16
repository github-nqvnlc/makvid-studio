# Deploy behind a Cloudflare Tunnel

Goal: the app at **https://makvid-studio.locnv.id.vn** from a machine with no open inbound ports. A `cloudflared`
container (see `docker/compose.tunnel.yml`) keeps an outbound connection to Cloudflare, which terminates TLS.

## Hostnames

| Public hostname             | Goes to                 | Why                                                              |
| --------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `makvid-studio.locnv.id.vn` | `http://web:3000`       | the app                                                          |
| `makvid-s3.locnv.id.vn`     | `http://seaweedfs:8333` | browsers download videos, subtitles and avatars from signed URLs |

The object store needs its own public hostname because signed links are bound to the host that signed them. It is a
**single-level** name on purpose: Cloudflare's free Universal SSL certificate covers `*.locnv.id.vn` but not a second
level such as `s3.makvid-studio.locnv.id.vn`.

## 1. Cloudflare side (once, in the dashboard)

1. The zone `locnv.id.vn` must be on Cloudflare (Websites -> Add a site, then change the nameservers at your registrar).
2. Zero Trust -> Networks -> Tunnels -> **Create a tunnel** -> Cloudflared -> name it `makvid-studio`.
3. Copy the **tunnel token** (the long string after `--token`). Do not paste it anywhere except `.env`.
4. Public hostnames tab -> add the two rows of the table above (type HTTP, URL `web:3000` and `seaweedfs:8333`).
   Cloudflare creates the proxied CNAME records for you.

## 2. Server side

In `.env` (copy `.env.example` if you have not) set, besides the secrets the file already asks for:

```bash
TUNNEL_TOKEN=<token from step 1.3>
APP_URL=https://makvid-studio.locnv.id.vn
BETTER_AUTH_URL=https://makvid-studio.locnv.id.vn
S3_PUBLIC_ENDPOINT=https://makvid-s3.locnv.id.vn
MAKVID_MOCK_PROVIDERS=0          # real providers (keys in .env)
MAKVID_PAYMENTS=off              # or polar / payos / polar,payos; "mock" is refused in production
METRICS_TOKEN=<random>           # /api/metrics needs it
POSTGRES_PASSWORD, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, BETTER_AUTH_SECRET, MAKVID_SECRET_KEY: long random values
```

Start (or update) the stack with the overlay:

```bash
docker compose -f compose.tunnel.yaml up -d --build
docker compose -f compose.tunnel.yaml ps      # cloudflared must be "healthy"
```

Run it from the repo root. `compose.tunnel.yaml` loads `./.env` for you; if you call `docker/compose.yml` with `-f` yourself, add `--env-file .env`, otherwise Compose looks for `.env` inside `docker/` and reports missing variables. The plain `docker compose up -d --build` (root `compose.yaml`) starts the same stack **without** the tunnel.

The overlay also rebinds the web and object-store host ports to `127.0.0.1`, so nothing is reachable from the LAN or
the internet except through the tunnel.

## 3. Verify

```bash
curl -fsS https://makvid-studio.locnv.id.vn/api/health            # {"status":"ok",...}
curl -sI  https://makvid-studio.locnv.id.vn/vi/sign-in | head -1  # HTTP/2 200
```

Then in a browser: sign up, create a video, and check that the player loads (the video URL must start with
`https://makvid-s3.locnv.id.vn/`). If the video does not play, the signed link is on the wrong host: recheck
`S3_PUBLIC_ENDPOINT` and recreate the `web` container (`up -d` after editing `.env`).

Callback and webhook URLs to register with the providers:

- Google sign-in redirect: `https://makvid-studio.locnv.id.vn/api/auth/callback/google`
- Polar webhook: `https://makvid-studio.locnv.id.vn/api/billing/webhooks/polar`
- PayOS webhook: `https://makvid-studio.locnv.id.vn/api/billing/webhooks/payos`

## Things to know

- **Upload size.** Cloudflare accepts request bodies up to 100 MB on the Free and Pro plans, while the app allows
  audio/video uploads up to 200 MB. Larger uploads fail at Cloudflare with an error page.
- **Video through the CDN.** Cloudflare's self-serve terms restrict serving large amounts of video through its proxy on
  the Free plan. For real traffic, point `S3_PUBLIC_ENDPOINT` at Cloudflare R2 (the storage layer is S3-compatible,
  configuration only) instead of proxying SeaweedFS, or move to a plan that allows it.
- **Live progress.** The editor's progress stream (`/api/projects/<id>/events`) is a long-lived response. Cloudflare closes
  idle connections after about 100 s; the browser reconnects by itself.
- **Admin.** Consider a Cloudflare Access policy on `makvid-studio.locnv.id.vn/admin*` (email allowlist) as a second lock.
- **Secrets.** The tunnel token gives control of the tunnel: keep it only in `.env` (git-ignored), and roll it in the
  dashboard if it ever leaks.
- **Stop exposing.** `docker compose -f compose.tunnel.yaml stop cloudflared`, or delete the
  public hostnames in the dashboard.
