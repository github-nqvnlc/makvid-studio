# Contract: Style pack

Mỗi style pack nằm ở `packages/styles/<style-id>/`. Thêm thư mục mới thì có style mới, không sửa
code lõi. Loader kiểm toàn bộ contract này lúc build. Nếu sai thì build fail.

```text
packages/styles/<style-id>/
├── manifest.json
├── tokens.json                 # màu, font, type scale, spacing, radius, shadow
├── fonts/                      # file font tự host + LICENSE
├── templates/<template-id>/
│   ├── schema.json             # slot: kiểu, required, maxLength/maxItems
│   ├── layout.16x9.html  layout.9x16.html  layout.1x1.html  layout.4x5.html
│   └── template.ts             # build timeline từ slots + timing (dùng style-kit)
├── presets/                    # enter, exit, emphasis, transition
├── captions.json               # kiểu phụ đề
├── sfx/                        # bộ SFX + LICENSE
├── prompt.md                   # tinh thần thị giác, nên/không nên, ví dụ cảnh mẫu
├── demo/                       # demo-30s.mp4 (cùng kịch bản mẫu), thumbnail.webp
└── golden/<aspect>/<template-id>/<frame-ms>.png
```

## manifest.json

```json
{
  "id": "minimal",
  "version": "1.0.0",
  "name": { "vi": "Tối giản / doanh nghiệp", "en": "Minimal / corporate" },
  "description": { "vi": "...", "en": "..." },
  "contentTypes": ["explainer", "news", "changelog"],
  "aspectRatios": ["16:9", "9:16", "1:1", "4:5"],
  "templates": ["hook", "title", "highlight", "list", "compare", "stat", "quote", "cta"],
  "runtime": "gsap",
  "libraries": [{ "name": "gsap", "version": "3.15.1", "license": "GSAP-Standard" }],
  "musicMoods": ["calm", "corporate"],
  "safeArea": { "9:16": { "top": 0.1, "bottom": 0.2, "left": 0.06, "right": 0.14 } },
  "perfBudget": { "maxMsPerFrame": 80 }
}
```

## Quy tắc bắt buộc (lint tự động)

- Cấm `Math.random`, `Date.now`, `performance.now`, `setTimeout`, `setInterval`,
  `requestAnimationFrame` trực tiếp. Phải dùng `styleKit.rng(seed)` và thời gian lấy từ timeline.
- Cấm URL tuyệt đối `http(s)://`, `@import` từ xa, `<script src>` ngoài gói.
- Bắt buộc đủ 8 template × 4 layout. Mỗi slot text có `maxLength`. Text đi qua `styleKit.fitText`
  (co cỡ chữ xuống tới `minFontSize`, rồi xuống dòng theo từ, không ngắt giữa từ).
- Hiệu ứng tách chữ dùng `Intl.Segmenter` (grapheme) trên chuỗi NFC để không tách dấu khỏi chữ.
- Font phải có đủ glyph tiếng Việt và có file LICENSE cho phép dùng thương mại.
- Timeline phải seekable. Test seek ngẫu nhiên có seed: frame tại t phải giống nhau dù tới đó theo thứ tự nào.
