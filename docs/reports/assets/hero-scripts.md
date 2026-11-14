# Hero demo scripts (UI-G2, T034)

About 12 seconds, 9:16, one video per language. Neutral subject (a coffee shop weekly promotion) so nothing real is
shown. The owner waived the approval step on 2026-11-14 ("không cần tôi duyệt"); please still review the wording.

## Vietnamese (`hero.vi.mp4`)

1. "Cuối tuần này, quán cà phê nhỏ của bạn cần một video giới thiệu." (≈3 s)
2. "Chỉ cần gõ một câu, MakVid Studio viết kịch bản, chọn giọng đọc và dựng phụ đề." (≈5 s)
3. "Duyệt xong, tải về và đăng ngay." (≈2.5 s)

## English (`hero.en.mp4`)

1. "This weekend, your little coffee shop needs a promo video." (≈3 s)
2. "Type one sentence. MakVid Studio writes the script, picks a voice and builds the captions." (≈5 s)
3. "Review, download, and post." (≈2.5 s)

## Status

Scripts written. The render is **not done**: it needs the Linux render container with real voices (paid TTS) and a
transcode to ≤ 1.5 MB MP4 + WebP poster in `apps/web/public/demo/hero.<locale>.{mp4,webp}`. Until those files exist
the hero shows a drawn 9:16 frame (`Hero.tsx` checks for the files). Command to run later:
`pnpm makvid produce --prompt "<script 1+2+3>" --aspect 9:16 --style minimal` inside the render container.
