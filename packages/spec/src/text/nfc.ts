/** Vietnamese text must be NFC everywhere (constitution IV): composed diacritics, one code point per glyph. */
export function nfc(text: string): string {
  return text.normalize("NFC");
}

export function isNfc(text: string): boolean {
  return text === text.normalize("NFC");
}

/** Recursively NFC-normalize every string (values and keys) in a JSON-like value. */
export function normalizeDeep<T>(value: T): T {
  if (typeof value === "string") return nfc(value) as T;
  if (Array.isArray(value)) return value.map((v) => normalizeDeep(v)) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[nfc(k)] = normalizeDeep(v);
    return out as T;
  }
  return value;
}

/** Paths of strings that are not NFC, e.g. ["script/0/text"]. Empty when the value is fully NFC. */
export function findNonNfc(value: unknown, path = ""): string[] {
  if (typeof value === "string") return isNfc(value) ? [] : [path || "/"];
  if (Array.isArray(value)) return value.flatMap((v, i) => findNonNfc(v, `${path}/${i}`));
  if (value !== null && typeof value === "object")
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      findNonNfc(v, `${path}/${k}`),
    );
  return [];
}
