// Scaffold the 8 templates x 4 aspect layouts of a style pack from a per-pack type scale.
// The generated layout.*.html files are the source of truth afterwards (hand-editable).
// Usage: node scripts/scaffold-layouts.mjs <packDir> <variant: minimal|kinetic|infographic>
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const [packDir, variant = "minimal"] = process.argv.slice(2);
if (!packDir) throw new Error("usage: scaffold-layouts.mjs <packDir> <variant>");

// Content region = safe area minus the caption band (see pack.css --cap-band).
const REGION = {
  "16:9": { W: 1690, H: 759, file: "layout.16x9.html", wide: true },
  "9:16": { W: 864, H: 1144, file: "layout.9x16.html", wide: false },
  "1:1": { W: 928, H: 746, file: "layout.1x1.html", wide: false },
  "4:5": { W: 918, H: 919, file: "layout.4x5.html", wide: false },
};
const SCALE = {
  minimal: {
    "16:9": [124, 92, 56, 40, 30],
    "9:16": [124, 100, 66, 48, 38],
    "1:1": [100, 80, 52, 40, 30],
    "4:5": [110, 88, 58, 42, 32],
  },
  kinetic: {
    "16:9": [150, 104, 60, 42, 32],
    "9:16": [124, 96, 60, 46, 36],
    "1:1": [116, 88, 54, 40, 30],
    "4:5": [124, 96, 60, 44, 32],
  },
  infographic: {
    "16:9": [112, 84, 52, 38, 28],
    "9:16": [116, 92, 62, 46, 36],
    "1:1": [92, 74, 48, 36, 28],
    "4:5": [100, 80, 54, 40, 30],
  },
}[variant];
const r = Math.round;

function layouts(a) {
  const { W, H, wide } = REGION[a];
  const [xl, l, m, s, xs] = SCALE[a];
  const lt = variant === "kinetic" ? 1.0 : 1.08; // display line height
  const fit = (path, o) =>
    `{{fit ${path} w=${r(o.w)} h=${r(o.h)} max=${r(o.max)} min=${r(o.min)} lh=${o.lh ?? 1.15} font=${o.font ?? "body"}${o.lines ? ` lines=${o.lines}` : ""}${o.group ? ` group=${o.group}` : ""}${o.balance === false ? " balance=false" : ""}${o.features ? ` features=${o.features}` : ""}}}`;
  const side = a !== "9:16"; // compare cards side by side except on 9:16
  const cardW = side ? (W - 48) / 2 : W;
  const cardPad = wide ? 48 : side ? 32 : 40;
  const bulletW = r(m * 1.6);
  const bars = variant === "infographic" ? "chart" : "bars";
  // Vertical budgets: boxes are sized so the worst case (max items, max length) still fits the region.
  const G = { "16:9": 36, "9:16": 40, "1:1": 28, "4:5": 32 }[a];
  const listTitleH = l * 1.12 * 2;
  const listItemH = Math.min(m * 1.25 * 2, (0.85 * (H - listTitleH - G - 3 * G * 0.6) - 4 * 16) / 4);
  const cmpTitleH = l * 1.1 * (wide ? 1 : 2);
  const perCard = 0.94 * (side ? H - cmpTitleH - G : (H - cmpTitleH - G - G * 0.7) / 2);
  const labelLines = side && !wide ? 2 : 1;
  const cmpItemH = Math.min(s * 1.3 * 2, (perCard - 2 * cardPad - m * 1.2 * labelLines - 18 - 24) / 3);
  return {
    hook: `<div class="region hook">
  <div class="deco" aria-hidden="true"></div>
  {{#if kicker}}<div class="kicker" data-qa="kicker">${fit("kicker", { w: W * 0.9, h: s * 1.4, max: s, min: xs, lines: 1, font: "body" })}</div>{{/if}}
  <h1 class="headline" data-qa="headline">${fit("headline", { w: W * (wide ? 0.82 : 0.95), h: H * 0.62, max: xl, min: xl * 0.55, lh: lt, lines: 4, font: "display" })}</h1>
  <div class="rule" aria-hidden="true"></div>
</div>
`,
    title: `<div class="region title">
  <div class="deco" aria-hidden="true"></div>
  <h1 class="title-text" data-qa="title">${fit("title", { w: W * 0.9, h: H * 0.55, max: xl, min: xl * 0.5, lh: lt, lines: 4, font: "display" })}</h1>
  {{#if subtitle}}<p class="subtitle" data-qa="subtitle">${fit("subtitle", { w: W * (wide ? 0.8 : 0.95), h: m * 1.3 * 3, max: m, min: xs, lh: 1.3, lines: 3 })}</p>{{/if}}
</div>
`,
    highlight: `<div class="region highlight">
  <p class="hl-text" data-qa="text">${fit("text", { w: W * 0.92, h: H * 0.72, max: l, min: m * 0.9, lh: 1.2, lines: 5, font: "display" })}</p>
</div>
`,
    list: `<div class="region list">
  <h2 class="list-title" data-qa="title">${fit("title", { w: W, h: l * 1.12 * 2, max: l, min: m, lh: 1.12, lines: 2, font: "display" })}</h2>
  <ol class="items">{{#each items}}
    <li class="item" data-qa="item"><span class="bullet" style="width:${bulletW}px">{{@num}}</span><span class="item-text">${fit("item", { w: W - bulletW - 28, h: listItemH, max: m, min: Math.min(s, listItemH / 2.6), lh: 1.25, lines: 2, group: "items" })}</span></li>{{/each}}
  </ol>
</div>
`,
    compare: `<div class="region compare">
  <h2 class="cmp-title" data-qa="title">${fit("title", { w: W, h: cmpTitleH, max: l, min: m, lh: 1.1, lines: wide ? 1 : 2, font: "display" })}</h2>
  <div class="cards">
    <div class="card left" data-qa="card-left" data-qa-box style="width:${r(cardW)}px">
      <div class="card-label">${fit("leftLabel", { w: cardW - 2 * cardPad, h: m * 1.2 * labelLines, max: m, min: xs, lh: 1.2, lines: labelLines, font: "display", group: "labels" })}</div>
      <ul class="card-items">{{#each leftItems}}<li class="ci">${fit("item", { w: cardW - 2 * cardPad - 36, h: cmpItemH, max: s, min: Math.min(xs, cmpItemH / 1.3), lh: 1.3, lines: 2, group: "cmp" })}</li>{{/each}}</ul>
    </div>
    <div class="card right" data-qa="card-right" data-qa-box style="width:${r(cardW)}px">
      <div class="card-label">${fit("rightLabel", { w: cardW - 2 * cardPad, h: m * 1.2 * labelLines, max: m, min: xs, lh: 1.2, lines: labelLines, font: "display", group: "labels" })}</div>
      <ul class="card-items">{{#each rightItems}}<li class="ci">${fit("item", { w: cardW - 2 * cardPad - 36, h: cmpItemH, max: s, min: Math.min(xs, cmpItemH / 1.3), lh: 1.3, lines: 2, group: "cmp" })}</li>{{/each}}</ul>
    </div>
  </div>
</div>
`,
    stat: `<div class="region stat">
  <div class="stat-value" data-qa="value">{{#if prefix}}<span class="prefix">{{text prefix}}</span>{{/if}}<span class="num">${fit("valueText", { w: W * (wide ? 0.58 : 0.8), h: xl * 1.9, max: xl * 1.8, min: xl * 0.6, lh: 1, lines: 1, font: "display", features: "tnum" })}</span>{{#if suffix}}<span class="suffix">{{text suffix}}</span>{{/if}}</div>
  <p class="stat-label" data-qa="label">${fit("label", { w: W * (wide ? 0.6 : 0.95), h: m * 1.3 * 3, max: m, min: xs, lh: 1.3, lines: 3 })}</p>
  {{#if series}}<div class="${bars}" data-qa="chart" data-qa-box>{{#each series.series}}<div class="bar-col"><div class="bar" data-v="{{attr item.value}}"></div><div class="bar-label">{{text item.label}}</div></div>{{/each}}</div>{{/if}}
</div>
`,
    quote: `<div class="region quote">
  <div class="qmark" aria-hidden="true">“</div>
  <blockquote class="q-text" data-qa="quote">${fit("quote", { w: W * 0.92, h: H * 0.6, max: l, min: m * 0.75, lh: 1.2, lines: 6, font: "display" })}</blockquote>
  {{#if author}}<div class="q-author" data-qa="author">${fit("author", { w: W * 0.95, h: s * 1.4, max: s, min: xs * 0.85, lines: 1 })}</div>{{/if}}
</div>
`,
    cta: `<div class="region cta">
  <div class="deco" aria-hidden="true"></div>
  <h1 class="cta-head" data-qa="headline">${fit("headline", { w: W * 0.9, h: H * 0.45, max: xl, min: xl * 0.55, lh: lt, lines: 3, font: "display" })}</h1>
  <div class="cta-btn" data-qa="action">${fit("action", { w: W * (wide ? 0.7 : 0.85), h: m * 1.3, max: m, min: xs, lines: 1, font: "display" })}</div>
  {{#if handle}}<div class="cta-handle" data-qa="handle">${fit("handle", { w: W * (wide ? 0.7 : 0.95), h: s * 1.4, max: s, min: xs * 0.85, lines: 1 })}</div>{{/if}}
</div>
`,
  };
}

for (const a of Object.keys(REGION)) {
  const ls = layouts(a);
  for (const [t, html] of Object.entries(ls))
    writeFileSync(join(packDir, "templates", t, REGION[a].file), html);
}
console.log(`layouts written for ${variant} in ${packDir}`);
