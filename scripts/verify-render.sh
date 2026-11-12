#!/usr/bin/env bash
# Reproducible M1 verification inside the Linux render container (network disabled):
#   1. golden frames for every style pack (--update writes them into packages/styles/<id>/golden)
#   2. MIT fallback runtime (mkv) against the GSAP goldens of "minimal" (ADR 0001 exit path)
#   3. renderer contract tests + max-length overflow harness
#   4. sample spec rendered twice in 4 aspects with frame hashes (determinism)
#   5. style demos (9:16) and a full fallback-renderer + mkv-runtime render
# Usage: scripts/verify-render.sh [--update-goldens]   (from the repo root, Docker running)
#        SKIP_PRE=1 scripts/verify-render.sh   (only steps 4-5: renders and demos)
set -euo pipefail
IMAGE=${IMAGE:-makvid-render:dev}
OUT=${OUT:-tests/visual/out/m1}
UPDATE=${1:-}
ROOT=$(pwd)
host_path() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
export MSYS_NO_PATHCONV=1
mkdir -p "$OUT"
RUN=(docker run --rm --network none --cpus 8 --memory 14g --shm-size 2g)
VOL_OUT=(-v "$(host_path "$ROOT/$OUT"):/out")
# Every installed style pack (folder with a manifest).
PACKS=$(for d in packages/styles/*/; do [ -f "$d/manifest.json" ] && basename "$d"; done)
golden_vols() { for s in $PACKS; do mkdir -p "packages/styles/$s/golden"; printf -- "-v %s:/app/packages/styles/%s/golden " "$(host_path "$ROOT/packages/styles/$s/golden")" "$s"; done; }

docker build -q -f docker/worker-render.Dockerfile -t "$IMAGE" . >/dev/null
if [ -z "${SKIP_PRE:-}" ]; then
echo "== goldens"
for s in $PACKS; do
  # shellcheck disable=SC2046
  "${RUN[@]}" $(golden_vols) "${VOL_OUT[@]}" "$IMAGE" golden "$s" --out /out/golden ${UPDATE:+--update} > "$OUT/golden-$s.log"
  tail -1 "$OUT/golden-$s.log"
done
echo "== fallback runtime (mkv) vs GSAP goldens: minimal"
# shellcheck disable=SC2046
"${RUN[@]}" $(golden_vols) "${VOL_OUT[@]}" "$IMAGE" golden minimal --runtime mkv --out /out/golden-mkv > "$OUT/golden-minimal-mkv.log" || true
tail -1 "$OUT/golden-minimal-mkv.log"
echo "== contract + overflow tests"
"${RUN[@]}" -e NO_COLOR=1 -e MAKVID_RENDER_TESTS=1 -e MAKVID_VISUAL_TESTS=1 --entrypoint pnpm "$IMAGE" -r --filter @makvid/renderer --filter @makvid/tests test > "$OUT/tests.log" 2>&1 || { tail -40 "$OUT/tests.log"; exit 1; }
sed "s/[[0-9;]*m//g" "$OUT/tests.log" | grep -E "Tests +[0-9]" || true
fi
echo "== sample spec x2 (4 aspects, frame hashes)"
for run in a b; do
  "${RUN[@]}" "${VOL_OUT[@]}" "$IMAGE" render /app/fixtures/specs/sample-vi.json --out "/out/run-$run" --no-cache --frame-hashes --json > "$OUT/run-$run.ndjson"
done
for a in 16x9 9x16 1x1 4x5; do
  if cmp -s "$OUT/run-a/$a/frames.sha256" "$OUT/run-b/$a/frames.sha256"; then echo "$a: identical ($(wc -l < "$OUT/run-a/$a/frames.sha256") frames)"; else echo "$a: DIFFERENT"; exit 1; fi
done
echo "== style demos 9:16 + fallback renderer"
for s in $PACKS; do
  [ "$s" = minimal ] && continue
  "${RUN[@]}" "${VOL_OUT[@]}" "$IMAGE" render /app/fixtures/specs/sample-vi.json --style "$s" --aspect 9:16 --out "/out/demo-$s" --json > "$OUT/demo-$s.ndjson"
done
"${RUN[@]}" "${VOL_OUT[@]}" "$IMAGE" render /app/fixtures/specs/sample-vi.json --aspect 9:16 --renderer fallback --runtime mkv --out /out/fallback-mkv --json > "$OUT/fallback-mkv.ndjson"
echo "done: $OUT"
