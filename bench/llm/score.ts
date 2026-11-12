// Automatic scoring of one storyboard output. Human (blind) rating is done separately on samples.
import { TEMPLATES } from "./task";

export interface Score {
  parseOk: boolean;
  sceneCount: number;
  structureOk: boolean; // 6–8 scenes, starts with hook, ends with cta
  violations: string[]; // schema / slot-limit violations
  vietnameseRatio: number; // share of words carrying Vietnamese diacritics (0..1)
  foreignScript: boolean; // CJK / Cyrillic / Thai leaked into the text
  nfc: boolean;
  maxNarrationWords: number;
  onScreenWordsOver12: number; // scenes whose on-screen text exceeds ~12 words
}

/** Extract the first top-level JSON object from a model reply (tolerates ```json fences). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("no JSON object");
  }
}

const VI_DIACRITIC = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const FOREIGN = /[぀-ヿ㐀-鿿가-힯Ѐ-ӿ฀-๿]/;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);

export function score(text: string): Score {
  const base: Score = {
    parseOk: false,
    sceneCount: 0,
    structureOk: false,
    violations: [],
    vietnameseRatio: 0,
    foreignScript: FOREIGN.test(text),
    nfc: text === text.normalize("NFC"),
    maxNarrationWords: 0,
    onScreenWordsOver12: 0,
  };
  let data: { title?: unknown; scenes?: Array<{ templateId?: unknown; narration?: unknown; slots?: Record<string, unknown> }> };
  try {
    data = extractJson(text) as typeof data;
  } catch {
    return base;
  }
  if (!data || !Array.isArray(data.scenes)) return { ...base, violations: ["missing scenes[]"] };
  const s: Score = { ...base, parseOk: true, sceneCount: data.scenes.length };
  s.structureOk = s.sceneCount >= 6 && s.sceneCount <= 8 && data.scenes[0]?.templateId === "hook" && data.scenes[s.sceneCount - 1]?.templateId === "cta";
  const allText: string[] = [];
  data.scenes.forEach((sc, i) => {
    const at = `scene ${i + 1}`;
    const tpl = typeof sc.templateId === "string" ? TEMPLATES[sc.templateId] : undefined;
    if (!tpl) {
      s.violations.push(`${at}: unknown template ${String(sc.templateId)}`);
      return;
    }
    if (typeof sc.narration !== "string" || !sc.narration.trim()) s.violations.push(`${at}: missing narration`);
    else {
      allText.push(sc.narration);
      s.maxNarrationWords = Math.max(s.maxNarrationWords, words(sc.narration).length);
      if (words(sc.narration).length > 30) s.violations.push(`${at}: narration > 30 words`);
    }
    const slots = sc.slots ?? {};
    let onScreen = 0;
    for (const [k, d] of Object.entries(tpl)) {
      const v = slots[k];
      if (v === undefined || v === "" || v === null) {
        if (d.required) s.violations.push(`${at}: ${sc.templateId}.${k} missing`);
        continue;
      }
      if (d.type === "text") {
        if (typeof v !== "string") s.violations.push(`${at}: ${k} not text`);
        else {
          allText.push(v);
          onScreen += words(v).length;
          if ([...v].length > d.maxLength) s.violations.push(`${at}: ${k} ${[...v].length}>${d.maxLength} chars`);
        }
      } else if (d.type === "number") {
        if (typeof v !== "number") s.violations.push(`${at}: ${k} not number`);
      } else if (d.type === "list") {
        if (!Array.isArray(v)) s.violations.push(`${at}: ${k} not list`);
        else {
          if (v.length > d.maxItems) s.violations.push(`${at}: ${k} ${v.length}>${d.maxItems} items`);
          for (const it of v)
            if (typeof it !== "string") s.violations.push(`${at}: ${k} item not text`);
            else {
              allText.push(it);
              onScreen += words(it).length;
              if ([...it].length > d.itemMaxLength) s.violations.push(`${at}: ${k} item ${[...it].length}>${d.itemMaxLength} chars`);
            }
        }
      } else if (d.type === "series") {
        const arr = (v as { series?: unknown }).series;
        if (!Array.isArray(arr)) s.violations.push(`${at}: ${k} not series`);
        else if (arr.length > d.maxItems) s.violations.push(`${at}: ${k} ${arr.length}>${d.maxItems} points`);
      }
    }
    for (const k of Object.keys(slots)) if (!(k in tpl)) s.violations.push(`${at}: unknown slot ${k}`);
    if (onScreen > 12) s.onScreenWordsOver12++;
  });
  const ws = allText.flatMap(words);
  s.vietnameseRatio = ws.length ? ws.filter((w) => VI_DIACRITIC.test(w)).length / ws.length : 0;
  return s;
}
