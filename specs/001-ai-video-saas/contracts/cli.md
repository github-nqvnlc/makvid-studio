# Contract: CLI `makvid` (M1)

```text
makvid render <spec.json> [--out <dir>] [--aspect 16:9,9:16,1:1,4:5] [--renderer hyperframes|fallback]
              [--fps 30] [--no-cache] [--frame-hashes]
makvid qa <spec.json> [--out <dir>]                 # chụp frame mốc + báo cáo tràn/đè/safe area
makvid golden <style-id> [--update]                 # so khớp / cập nhật golden frames
makvid lint-style <style-id>                         # kiểm contract style pack
makvid validate <spec.json>                          # zod parse + migration dry-run
```

- Exit code: `0` thành công, `1` lỗi đầu vào/validation, `2` QA fail, `3` lỗi render.
- `--frame-hashes` ghi `frames.sha256` (mỗi dòng một frame) để chứng minh render tất định.
- Đầu ra cho mỗi tỷ lệ: `<out>/<aspect>/video.mp4`, `captions.srt`, `thumbnail.jpg`, `report.json`.
- stdout dành cho người: dòng tiến độ. Thêm `--json` thì in NDJSON event cho máy đọc.
