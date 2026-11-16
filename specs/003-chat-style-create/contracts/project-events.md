# Contract: Project activity log

All endpoints require a signed-in member of the project's workspace (`guarded`), otherwise the existing 401/403/404 behavior. Responses never contain `error_detail`, job ids, provider or tool names.

## GET `/api/projects/{id}/log`

Query: `after` (seq, default 0), `limit` (1–200, default 200), `locale` (`vi` | `en`, default `vi`), `dir` (`forward` default | `backward` for "load earlier", with `before` instead of `after`).

200 response:

```json
{
  "entries": [
    {
      "seq": 412,
      "at": "2026-11-16T09:30:12.000Z",
      "stage": "voice",
      "kind": "progress",
      "severity": "info",
      "text": "Đang tạo giọng đọc cho cảnh 3/8",
      "fraction": 0.42
    }
  ],
  "stages": [
    { "stage": "script", "state": "done" },
    { "stage": "voice", "state": "running" }
  ],
  "status": "producing_audio",
  "nextAfter": 412,
  "hasMore": false
}
```

`text` is localized server-side from `key` + `params`. `stages` lists all stages in fixed order.

## GET `/api/projects/{id}/events?locale=vi|en` (extended SSE)

Existing `data:` frames (status, title, headVersionId, text, fraction) are kept unchanged for the editor. New frames:

```text
id: 412
event: log
data: {"seq":412,"at":"…","stage":"voice","kind":"progress","severity":"info","text":"…","fraction":0.42}

event: stages
data: {"stages":[{"stage":"voice","state":"running"}]}
```

- `id` = entry `seq`; on reconnect the browser sends `Last-Event-ID` and the server replays entries with `seq > id` before live ones (no gaps, no duplicates; client also de-duplicates by `seq`).
- A `: ping` comment is sent about every 15 s (existing behavior).
- Delivery target: ≤ 2 s from insert (1 s poll).

## Errors

| Case | Response |
| --- | --- |
| Not a member / unknown project | same as `GET /api/projects/{id}` |
| Bad `after`/`limit` | 400 with the standard user-facing error key |

## Message keys (new, vi + en in `@makvid/pipeline` messages)

`log.stage.start.<stage>`, `log.stage.done.<stage>`, `log.voice.scene {current,total}`, `log.render.scene {current,total}`, `log.qa.fix {attempt}`, `log.approval.needed.<stage>`, `log.approval.done`, `log.retry {attempt}`, `log.error.<friendlyCode>`, `log.done`. Keys outside this allow-list are rejected at write time.
