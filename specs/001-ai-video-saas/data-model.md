# Data Model (Phase 1)

**Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)

Quy ước chung:

- Mọi bảng thuộc tenant đều có `workspace_id` (FK) và chịu Postgres Row-Level Security theo
  `current_setting('app.workspace_id')`. Bảng toàn cục (`users`, `plans`, `style_packs`, `voices`,
  `music_tracks`) không có RLS tenant.
- Khóa chính là `uuid` (v7, có thứ tự theo thời gian). Có `created_at` và `updated_at` (timestamptz).
- Text người dùng nhập được chuẩn hóa NFC trước khi lưu.
- File không lưu trong DB, chỉ lưu `storage_key` (S3) + `sha256` + `bytes` + `mime`.

## Tài khoản và tenant

| Entity                   | Trường chính                                                                                            | Quan hệ / ràng buộc                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **users**                | id, email (unique, lowercase), name, locale (`vi`\|`en`, mặc định `vi`), image_url, email_verified      | Do Better Auth quản lý (thêm bảng `sessions`, `accounts`, `verifications`) |
| **workspaces**           | id, name, slug (unique), plan_id, brand_kit_id?, retention_days, created_by                             | 1–n memberships, projects, assets…                                         |
| **memberships**          | workspace_id, user_id, role (`owner`\|`admin`\|`editor`\|`viewer`)                                      | unique(workspace_id, user_id); mỗi workspace có ≥ 1 owner                  |
| **invitations**          | workspace_id, email, role, token_hash, expires_at, accepted_at?                                         |                                                                            |
| **api_keys**             | workspace_id, name, prefix, key_hash (argon2id), scopes[], last_used_at, revoked_at?                    | Chỉ hiển thị key đầy đủ một lần                                            |
| **webhook_endpoints**    | workspace_id, url, secret_enc, events[], active                                                         | URL qua kiểm tra SSRF khi tạo và khi gửi                                   |
| **provider_credentials** | workspace_id? (null = cấu hình hệ thống), kind (`llm`\|`tts`\|`mediagen`), base_url, model, api_key_enc | `api_key_enc` = AES-256-GCM                                                |

**Quyền theo vai trò**: Owner được làm mọi thứ, kể cả billing và xóa workspace. Admin quản lý
thành viên, key, webhook và brand kit. Editor tạo và sửa dự án, chạy batch. Viewer chỉ xem và tải về.

## Dự án và VideoSpec

| Entity               | Trường chính                                                                                                                                                                   | Ghi chú                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **projects**         | workspace_id, title, mode (`auto`\|`review`), status, head_version_id, source_material_id?, template_id?, primary_aspect, export_aspects[], is_template, deleted_at?           | Nhân bản = copy project + version head            |
| **source_materials** | workspace_id, kind (`prompt`\|`script`\|`url`\|`github`\|`table`\|`media`), markdown, metadata (jsonb), attachments[] (asset ids), transcript? (jsonb words)                   | Bất biến sau khi tạo                              |
| **project_versions** | project_id, parent_version_id?, seq (tăng dần), spec (jsonb, VideoSpec), spec_version, patch? (jsonb RFC 6902), author (`ai`\|user_id), message (lời chat tóm tắt), created_at | Bất biến; undo/redo = di chuyển `head_version_id` |
| **chat_messages**    | project_id, version_id?, role (`user`\|`assistant`), content, target_scene_id?, kind (`edit`\|`clarify`\|`info`)                                                               | Câu hỏi lại khi yêu cầu mơ hồ có kind `clarify`   |

**Trạng thái project** (`status`):

```text
draft → ingesting → scripting → [awaiting_script_review] → styling → storyboarding
      → [awaiting_storyboard_review] → producing_audio → compiling → qa → rendering
      → ready | needs_attention (QA hết lượt) | failed (lỗi không tự phục hồi)
ready → (chat edit) → compiling … → ready
```

Hai trạng thái trong `[...]` chỉ xuất hiện ở chế độ `review`.

**Đồng thời**: sửa chat tạo version với `parent_version_id = head` (khóa lạc quan). Nếu head đã đổi
thì áp lại patch lên head mới. Nếu xung đột thì hỏi lại người dùng.

## Style và tài sản

| Entity           | Trường chính                                                                                                                                                                                                                                                                         | Ghi chú                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **style_packs**  | id (vd. `minimal`), version, manifest (jsonb), enabled, milestone                                                                                                                                                                                                                    | Đồng bộ từ `packages/styles/*` lúc deploy, không sửa bằng tay |
| **brand_kits**   | workspace_id, name, logo_asset_id?, colors (jsonb token overrides), font_asset_ids[]                                                                                                                                                                                                 | Font tải lên phải qua kiểm tra glyph tiếng Việt               |
| **assets**       | workspace_id, kind (`image`\|`video`\|`audio`\|`music`\|`voice_recording`\|`font`\|`generated_image`\|`generated_video`), storage_key, mime, bytes, sha256, width?, height?, duration_ms?, license (jsonb: source, terms, attribution), origin (`upload`\|`ingest`\|`ai`\|`library`) | Unique(workspace_id, sha256) để không lưu trùng               |
| **music_tracks** | id, title, storage_key, duration_ms, bpm, moods[], license (jsonb), attribution                                                                                                                                                                                                      | Thư viện hệ thống                                             |
| **sfx**          | id, pack (style id hoặc `common`), kind (`whoosh`\|`pop`\|`click`…), storage_key, license                                                                                                                                                                                            |                                                               |
| **voices**       | id, provider, provider_voice_id, language, gender, region (`north`\|`central`\|`south`\|null), sample_asset_key, supports_word_timestamps                                                                                                                                            |                                                               |

## Pipeline, render, chi phí

| Entity             | Trường chính                                                                                                                                                                                                                                                                                                                                                                                           | Ghi chú                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **jobs**           | workspace_id, project_id?, batch_item_id?, version_id, step (`ingest`\|`script`\|`style_suggest`\|`storyboard`\|`tts`\|`align`\|`compile`\|`qa`\|`render_scene`\|`mux`), input_hash, status (`queued`\|`running`\|`succeeded`\|`failed`\|`skipped_cached`), attempt, priority, progress, user_message_key, error_code?, error_detail (chỉ nội bộ), output (jsonb, tham chiếu), started_at, finished_at | unique(version_id, step, input_hash) bảo đảm idempotent       |
| **render_cache**   | cache_key (sha256), storage_key, frames, duration_ms, engine, engine_version, created_at, last_hit_at                                                                                                                                                                                                                                                                                                  | Toàn cục theo nội dung; chỉ đọc khi asset thuộc workspace gọi |
| **render_outputs** | workspace_id, project_id, version_id, aspect, storage_key (mp4), srt_key, thumbnail_key, duration_ms, width, height, fps, loudness_lufs, watermarked, expires_at                                                                                                                                                                                                                                       | `expires_at` = theo `retention_days` của gói                  |
| **qa_reports**     | job_id, scene_id, frame_ms, checks (jsonb: overflow, overlap, safe_area, contrast, glyph), score?, passed, fix_attempt                                                                                                                                                                                                                                                                                 |                                                               |
| **usage_records**  | workspace_id, project_id?, job_id?, step, provider, model?, tokens_in, tokens_out, tts_chars, images, video_seconds_generated, render_seconds, cost_usd (numeric(12,6)), created_at                                                                                                                                                                                                                    | Nguồn cho quota, billing, admin                               |

## Template và batch

| Entity          | Trường chính                                                                                                                                                                                        | Ghi chú                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **templates**   | workspace_id, project_id (nguồn), version_id (đóng băng), name, variables (jsonb: name, type, required, maxLength)                                                                                  | Biến dạng `{{ten_khach_hang}}`       |
| **batches**     | workspace_id, template_id, source_asset_id (CSV), status (`validating`\|`queued`\|`running`\|`completed`\|`completed_with_errors`\|`paused_quota`\|`cancelled`), total, succeeded, failed, zip_key? |                                      |
| **batch_items** | batch_id, row_index, variables (jsonb), project_id?, status, error_code?, render_output_id?                                                                                                         | Chạy lại = tạo job mới với cùng item |

## Billing

| Entity             | Trường chính                                                                                                                                                                                                                                                                     | Ghi chú                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **plans**          | id (`free`\|`starter`\|…), name_i18n, interval (`month`\|`year`\|null), price, currency, limits (jsonb: video_minutes, videos, tts_chars, ai_images, storage_bytes, concurrent_jobs, max_video_seconds, batch_enabled, api_enabled, mediagen_enabled), watermark, retention_days | `free`: 3 video, 60 giây, watermark, không batch/API/mediagen |
| **subscriptions**  | workspace_id, plan_id, provider, provider_ref, status, current_period_start/end, cancel_at?                                                                                                                                                                                      |                                                               |
| **credit_ledger**  | workspace_id, delta (minutes hoặc credit), reason (`purchase`\|`consume`\|`refund`\|`grant`), ref                                                                                                                                                                                | Số dư = tổng delta                                            |
| **usage_periods**  | workspace_id, period_start, period_end, counters (jsonb)                                                                                                                                                                                                                         | Cập nhật nguyên tử khi đặt chỗ và khi chốt                    |
| **payment_events** | provider, event_id (unique), payload, processed_at                                                                                                                                                                                                                               | Idempotent webhook từ cổng thanh toán                         |
| **abuse_signals**  | user_id?, ip_hash, device_hash, email_domain, kind                                                                                                                                                                                                                               | Chống lạm dụng gói miễn phí                                   |

**Kiểm quota**: trước khi enqueue, hệ thống _đặt chỗ_ (reserve) phút ước tính một cách nguyên tử
trên `usage_periods`. Nếu không đủ thì từ chối trước khi tốn chi phí (SC-008). Khi job xong thì
chốt số thật và hoàn phần dư.

## Validation chính (từ FR)

- `project.export_aspects` ⊆ {`16:9`,`9:16`,`1:1`,`4:5`}.
- Thời lượng mục tiêu nằm trong [30 s, 600 s]. Với gói `free` thì ≤ 60 s.
- `scenes[].slots.*` tuân thủ `maxLength` và kiểu do scene template định nghĩa (contracts/style-pack.md).
- Tỷ lệ cảnh `freeform` trên một video là < 20%. Nếu vượt thì cảnh báo trong QA, không chặn.
- Upload phải khớp allowlist MIME + sniff magic bytes + giới hạn kích thước theo loại.
