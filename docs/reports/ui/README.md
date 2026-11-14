# UI gate screenshots

Per gate folder, a representative set kept as WebP: light/Vietnamese/1280, dark/English/1280 and light/Vietnamese/360 for
each page. The full set (2 themes x 2 languages x 1280/360) is regenerated, not stored (PNG files here are git-ignored):

```bash
SCREENS_AUTH=1 SCREENS_PHASE=<name> SCREENS_PAGES="/,/projects/new,/account" pnpm --filter @makvid/web test:e2e e2e/screens.spec.ts
```
