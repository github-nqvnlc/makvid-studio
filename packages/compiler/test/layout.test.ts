import { describe, expect, it } from "vitest";
import { emphasisIndexes, parseLayout, renderLayout, wordKey, type RenderEnv } from "../src";

const env = (): RenderEnv => ({
  measureFor: () => (text, size) => [...text].length * 0.55 * size,
  emphasis: [],
  fits: [],
});

describe("layout language", () => {
  it("renders text, each, if/else, num and @num", () => {
    const src = `<h1>{{text title}}</h1>{{#if sub}}<p>{{text sub}}</p>{{else}}<p>none</p>{{/if}}<ol>{{#each items}}<li data-i="{{@num}}">{{text item}}</li>{{/each}}</ol><b>{{num value decimals=1}}</b>`;
    const html = renderLayout(
      parseLayout(src),
      { title: "A & <B>", items: ["x", "y"], value: 1234.5 },
      env(),
    );
    expect(html).toBe(
      `<h1>A &amp; &lt;B&gt;</h1><p>none</p><ol><li data-i="1">x</li><li data-i="2">y</li></ol><b>1.234,5</b>`,
    );
  });

  it("fits text into explicit lines of word spans and records the fit", () => {
    const e = env();
    const html = renderLayout(
      parseLayout("{{fit t w=600 h=300 max=100 min=40 lh=1.2 font=display}}"),
      { t: "Lãi kép là kỳ quan thứ tám" },
      e,
    );
    expect(html).toMatch(
      /^<span class="fit" data-w="600" style="font-size:\d+px;line-height:1.2">(<span class="ln">.*<\/span>)+<\/span>$/,
    );
    expect(html).toContain('<span class="w">Lãi</span>');
    expect(e.fits).toHaveLength(1);
    expect(e.fits[0]!.overflow).toBe(false);
  });

  it("gives a group one shared font size", () => {
    const e = env();
    renderLayout(
      parseLayout("{{#each items}}{{fit item w=500 h=60 max=50 min=20 group=g}}{{/each}}"),
      { items: ["ngắn", "một dòng dài hơn rất nhiều chữ"] },
      e,
    );
    expect(new Set(e.fits.map((f) => f.fontSize)).size).toBe(1);
  });

  it("rejects malformed blocks", () => {
    expect(() => parseLayout("{{#each items}}x")).toThrow(/unclosed/);
    expect(() => parseLayout("{{/if}}")).toThrow(/unexpected/);
    expect(() => parseLayout("{{else}}")).toThrow(/outside/);
  });

  it("emphasizes the phrase, not every occurrence of its words", () => {
    const words = "Lãi kép là khi tiền lãi tiếp tục sinh ra tiền lãi".split(" ");
    const idx = emphasisIndexes(words, ["sinh ra tiền lãi".split(" ").map(wordKey)]);
    expect([...idx].sort((a, b) => a - b)).toEqual([8, 9, 10, 11]);
  });
});
