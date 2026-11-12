// Copy self-hosted font files from an @fontsource package into a style pack's fonts/ folder and
// write fonts.json (faces + unicode-range) and the font LICENSE (constitution IV/VI).
// Usage: node scripts/vendor-fonts.mjs <packDir> <fontsourcePkg> <family> <weight> [<weight>...]
//        (repeat the pkg/family/weights group separated by "--" for several families)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [packDir, ...rest] = process.argv.slice(2);
if (!packDir || !rest.length) {
  console.error(
    "usage: vendor-fonts.mjs <packDir> <pkg> <family> <weight...> [-- <pkg> <family> <weight...>]",
  );
  process.exit(1);
}
const SUBSETS = ["latin", "latin-ext", "vietnamese"]; // declaration order: later wins on overlap
const groups = rest
  .join(" ")
  .split(" -- ")
  .map((g) => g.trim().split(/\s+/));
const outDir = join(packDir, "fonts");
mkdirSync(outDir, { recursive: true });
const faces = [];
let licenses = "";
for (const [pkg, familyRaw, ...weights] of groups) {
  const family = familyRaw.replace(/_/g, " ");
  const root = join("node_modules", pkg);
  const unicode = JSON.parse(readFileSync(join(root, "unicode.json"), "utf8"));
  const meta = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const slug = pkg.split("/")[1];
  for (const w of weights)
    for (const subset of SUBSETS) {
      const file = `${slug}-${subset}-${w}-normal.woff2`;
      const src = join(root, "files", file);
      if (!existsSync(src)) throw new Error(`missing ${src}`);
      copyFileSync(src, join(outDir, file));
      faces.push({ family, weight: Number(w), style: "normal", subset, file, unicodeRange: unicode[subset] });
    }
  licenses += `${family} (${pkg}@${meta.version}, ${meta.license})\n\n${readFileSync(join(root, "LICENSE"), "utf8")}\n\n`;
}
writeFileSync(join(outDir, "LICENSE"), licenses);
writeFileSync(join(outDir, "fonts.json"), JSON.stringify({ license: "LICENSE", faces }, null, 2) + "\n");
console.log(`vendored ${faces.length} faces into ${outDir}`);
