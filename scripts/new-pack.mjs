// Create the boilerplate of a new style pack: package.json, tsconfig, manifest, captions, schemas, layouts,
// fonts. pack.css, tokens.json, prompt.md and templates/*/template.ts are written by hand afterwards.
// Usage: node scripts/new-pack.mjs <id> <layoutVariant> <nameVi> <nameEn> <fontsourcePkg> <family> <weight...>
//        (font groups as in vendor-fonts.mjs, separated by "--")
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [id, variant, nameVi, nameEn, ...fontArgs] = process.argv.slice(2);
if (!id || !variant || !nameVi || !nameEn || !fontArgs.length)
  throw new Error("usage: new-pack.mjs <id> <variant> <nameVi> <nameEn> <font groups...>");
const dir = join("packages", "styles", id);
if (existsSync(join(dir, "manifest.json"))) throw new Error(`${dir} already exists`);
const TEMPLATES = ["hook", "title", "highlight", "list", "compare", "stat", "quote", "cta"];
for (const t of TEMPLATES) mkdirSync(join(dir, "templates", t), { recursive: true });
mkdirSync(join(dir, "demo"), { recursive: true });
const json = (f, v) => writeFileSync(join(dir, f), JSON.stringify(v, null, 2) + "\n");
json("package.json", {
  name: `@makvid/style-${id}`,
  version: "1.0.0",
  private: true,
  type: "module",
  scripts: { typecheck: "tsc -p .", lint: "eslint ." },
  dependencies: { "@makvid/style-kit": "workspace:*" },
  devDependencies: { "@makvid/config": "workspace:*" },
});
writeFileSync(
  join(dir, "tsconfig.json"),
  '{ "extends": "@makvid/config/tsconfig.base.json", "include": ["templates", "lib"] }\n',
);
json("manifest.json", {
  id,
  version: "1.0.0",
  name: { vi: nameVi, en: nameEn },
  description: { vi: "", en: "" },
  contentTypes: [],
  aspectRatios: ["16:9", "9:16", "1:1", "4:5"],
  templates: TEMPLATES,
  runtime: "gsap",
  libraries: [{ name: "gsap", version: "3.15.1", license: "GSAP-Standard" }],
  musicMoods: [],
  perfBudget: { maxMsPerFrame: 200 },
});
json("captions.json", {
  default: {
    font: "caption",
    maxFontSize: 52,
    minFontSize: 38,
    lineHeight: 1.25,
    maxWords: 7,
    boxWidth: 0.88,
    bottom: 0.01,
  },
});
const node = (args) => execFileSync(process.execPath, args, { stdio: "inherit" });
node(["scripts/scaffold-schemas.mjs", dir]);
node(["scripts/scaffold-layouts.mjs", dir, variant]);
node(["scripts/vendor-fonts.mjs", dir, ...fontArgs]);
console.log(`created ${dir}`);
