# ADR 0007 — Background music: Soundstripe API (licensed catalog), procedural beds as fallback

- **Status**: Accepted for integration (2026-11-12). Production use requires a signed Soundstripe partner
  agreement + live API key — **pending product owner**.
- **Context**: The product owner requires commercially licensed music (exported videos are published and
  monetized by end users, so the license must cover our users — sub-licensing / platform terms). Options checked
  2026-11-12 on the providers' own pages:
  - **Soundstripe API** (soundstripe.com/api, docs.soundstripe.com): 60k+ tracks by human artists; "licensing
    happens at the API layer", partnership can include cross-channel clearance, commercial coverage and
    indemnification; free 30-day trial key (watermarked MP3); production pricing via sales.
  - **Mubert API** (mubert.com/api/plans): AI-generated; sub-licensing only on _Startup+_ ($499/month on sale,
    list $999, 30,000 tracks/month); cheaper plans say "No sub-licensing".
  - **Epidemic Sound**: partnership via sales only; no public API terms found.
  - Jamendo Licensing: per-project licenses for creators, no platform license found.
    The product owner expressed no preference; the agent recommended Soundstripe.

## Decision

- `MusicProvider` interface in `packages/media` with `SoundstripeMusicProvider` (server-to-server,
  `Authorization: Token <key>`, JSON:API `/v1/songs` search filtered to instrumental tracks long enough for the
  video, deterministic pick per project) and `BuiltinMusicProvider` (project-owned procedural beds).
- Tracks are chosen at the storyboard stage and **downloaded at production time** (signed URLs expire after 7 days;
  WAV when the key allows it, otherwise MP3). The chosen track id, title, artist and license note are stored with
  the project as proof of use.
- No key, catalog error or download error → automatic fallback to the procedural beds, so production never
  blocks on the music provider.

## Consequences

- Product owner action: create a Soundstripe account, test with a trial key (`SOUNDSTRIPE_API_KEY` in `.env`),
  then sign a partner agreement covering end-user commercial use before paid plans launch (M5).
- Client apps never see the API key or WAV URLs (provider rule); previews in the web app use short-lived MP3 URLs
  proxied by our backend.
- Revisit if the Soundstripe agreement is not signed by M5 (Mubert Startup+ is the priced alternative).
