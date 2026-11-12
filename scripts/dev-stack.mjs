// Run the web app and the three stage workers together (needs `docker compose -f docker/compose.dev.yml up -d`).
//   node scripts/dev-stack.mjs          real providers (FPT key in .env)
//   node scripts/dev-stack.mjs --mock   mock LLM/TTS/aligner/renderer (no paid calls; E2E)
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mock = process.argv.includes("--mock");
// Load .env here: Next forwards node flags into NODE_OPTIONS, where --env-file is not allowed.
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // no .env: rely on the environment
}
const env = {
  ...process.env,
  ...(mock ? { MAKVID_MOCK_PROVIDERS: "1", QUEUE_PREFIX: process.env.QUEUE_PREFIX ?? "mkvmock" } : {}),
  WORK_ROOT: process.env.WORK_ROOT ?? join(root, ".work", mock ? "mock" : "dev"),
  MAKVID_ROOT: root,
};
const children = [];
function run(name, cwd, args) {
  const p = spawn(process.execPath, args, {
    cwd: join(root, cwd),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tag = (s) =>
    s
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .forEach((l) => console.log(`[${name}] ${l}`));
  p.stdout.on("data", tag);
  p.stderr.on("data", tag);
  p.on("exit", (code) => console.log(`[${name}] exited ${code}`));
  children.push(p);
}
for (const q of ["ai", "audio", "render"])
  run(`worker-${q}`, `apps/worker-${q}`, ["--import", "tsx", "src/index.ts"]);
run("web", "apps/web", ["node_modules/next/dist/bin/next", "dev", "--port", process.env.PORT ?? "3000"]);
const stop = () => {
  for (const c of children) c.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
