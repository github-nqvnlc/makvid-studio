// Written-script ingest (T112): the user's narration is kept word for word (NFC + whitespace only); it is only
// split into sentences so the storyboard can place them into scenes.
import { cleanText, type SourceMaterial } from "./types";

/** Split into sentences at . ! ? … (kept with the sentence) and at line breaks; never rewrites words. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of cleanText(text, 20_000).split("\n")) {
    if (!line) continue;
    // A sentence ends at . ! ? … (plus closing quotes/brackets) followed by whitespace and an upper-case letter,
    // digit or quote, so "3.5", "v2.0" and "e.g. this" stay inside their sentence.
    for (const p of line.split(/(?<=[.!?…]["”’)\]]*)\s+(?=[\p{Lu}\d"“(])/u)) {
      const s = p.trim();
      if (s) out.push(s);
    }
  }
  return out;
}

export function ingestScript(text: string, title?: string): SourceMaterial {
  const sentences = splitSentences(text);
  if (!sentences.length) throw new Error("the script is empty");
  if (sentences.length > 40) throw new Error("the script is too long (max 40 sentences)");
  return {
    kind: "script",
    markdown: sentences.join("\n"),
    ...(title?.trim() ? { title: title.normalize("NFC").trim() } : {}),
    sentences,
    metadata: { words: sentences.join(" ").split(/\s+/).length },
  };
}
