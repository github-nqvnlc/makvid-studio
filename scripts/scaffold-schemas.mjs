// Write the canonical slot schemas (same slot names in every pack, so one VideoSpec renders in any
// style) into packages/styles/<id>/templates/<template>/schema.json.
// Usage: node scripts/scaffold-schemas.mjs <packDir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const text = (maxLength, required = true) => ({ type: "text", required, maxLength });
// Limits follow SC-013 (≤ 12 words on screen) and are verified by tests/visual/overflow.test.ts.
export const SCHEMAS = {
  hook: { headline: text(48), kicker: text(24, false) },
  title: { title: text(56), subtitle: text(80, false) },
  highlight: { text: text(80), highlight: text(32, false) },
  list: { title: text(40), items: { type: "list", required: true, maxItems: 4, itemMaxLength: 40 } },
  compare: {
    title: text(40),
    leftLabel: text(20),
    leftItems: { type: "list", required: true, maxItems: 3, itemMaxLength: 32 },
    rightLabel: text(20),
    rightItems: { type: "list", required: true, maxItems: 3, itemMaxLength: 32 },
  },
  stat: {
    value: { type: "number", required: true },
    prefix: text(6, false),
    suffix: text(10, false),
    label: text(60),
    series: { type: "series", required: false, maxItems: 10 },
  },
  quote: { quote: text(110), author: text(40, false) },
  cta: { headline: text(48), action: text(28), handle: text(32, false) },
};

// Only write files when run directly (the LLM benchmark imports SCHEMAS).
const direct =
  process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
const packDir = direct ? process.argv[2] : undefined;
if (packDir) {
  for (const [id, slots] of Object.entries(SCHEMAS)) {
    const dir = join(packDir, "templates", id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "schema.json"), JSON.stringify({ slots }, null, 2) + "\n");
  }
  console.log(`schemas written to ${packDir}/templates`);
}
