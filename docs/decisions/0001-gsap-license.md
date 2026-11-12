# ADR 0001: Use GSAP behind an AnimationRuntime abstraction, seek written confirmation from Webflow

- **Status**: Accepted
- **Date**: 2026-11-12
- **Decided by**: product owner (legal/license decision, per constitution principle I)
- **Related**: [research.md R2](../../specs/001-ai-video-saas/research.md), constitution principle VI

## Context

GSAP `3.15.1` ships under the Webflow "Standard 'no charge' license" (gsap.com/standard-license,
read 2026-11-12). It forbids use "in tools that allow users to build visual animations without code"
that compete with Webflow's visual animation builder. Its FAQ states that AI-generated GSAP code is
not a prohibited use. Our product is a closed-source commercial SaaS where end users create animated
videos via chat (no visual timeline/builder), with AI generating the animation code. We believe this
is a permitted use, but it is a grey area for a paid no-code product.

## Decision

1. Style packs use GSAP, but only through a `AnimationRuntime` interface in `packages/style-kit`.
   No style pack or compiler code imports GSAP directly outside its runtime adapter.
2. GSAP is bundled locally (never loaded from a CDN at render time) and its version is pinned.
3. An MIT-licensed fallback runtime (Anime.js or plain WAAPI, both supported by HyperFrames
   adapters) is maintained. At M1, at least one style pack must pass its golden-frame tests on the
   fallback runtime to prove the exit path works.
4. Before public sale (no later than M5), the product owner requests written confirmation from
   Webflow that the product is a permitted use. The request and reply are archived in
   `docs/legal/` (not in the public repo docs).
5. The product must not add a visual animation builder/timeline editor without re-opening this ADR.

## Consequences

- Access to GSAP plugins (SplitText, DrawSVG, MorphSVG) lowers the cost of building the 13 styles.
- Some extra cost to keep the runtime abstraction and fallback tests.
- If Webflow declines or the license changes adversely, style packs migrate to the fallback runtime.
  We may keep using the GSAP version licensed before the change, per the license's amendment clause.
- Gate: the release checklist for M5 requires either Webflow's confirmation on file or completed
  migration to the fallback runtime.
