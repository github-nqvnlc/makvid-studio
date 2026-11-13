// Low-poly 3D background rendered with Three.js' SVGRenderer: geometry is projected on the CPU and drawn as SVG
// polygons, so it needs no WebGL/GPU in the headless render workers and every frame is a pure function of the
// scene time (ADR 0012). Shapes sit towards the frame edges, behind the text region.
import type { Rng, Timeline } from "@makvid/style-kit";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  DodecahedronGeometry,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Scene,
  TorusGeometry,
  type BufferGeometry,
} from "three";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";

const PALETTE = ["#4cc9f0", "#7b5cff", "#ff6b6b", "#ffd166"];

/** Normalised anchor points (x, y in -1..1 of the frame) near the edges, away from the text centre. */
const ANCHORS: Array<[number, number]> = [
  [-0.86, 0.78],
  [0.88, 0.62],
  [0.82, -0.7],
  [-0.9, -0.46],
];

export interface Scene3dOptions {
  /** Global speed of the rotation (1 = default). */
  spin?: number;
  /** Shape count 2–4. */
  count?: number;
}

export function scene3d(
  root: HTMLElement,
  tl: Timeline,
  rng: Rng,
  duration: number,
  width: number,
  height: number,
  opts: Scene3dOptions = {},
): void {
  const renderer = new SVGRenderer();
  renderer.setSize(width, height);
  renderer.setQuality("high");
  const svgEl = renderer.domElement;
  svgEl.setAttribute("class", "three-bg");
  svgEl.setAttribute("aria-hidden", "true");
  root.prepend(svgEl);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, width / height, 1, 100);
  camera.position.set(0, 0, 14);
  scene.add(new AmbientLight(new Color("#5b6bb5"), 1.1));
  const sun = new DirectionalLight(new Color("#ffffff"), 2.2);
  sun.position.set(4, 6, 8);
  scene.add(sun);

  // Visible half-extents of the z=0 plane, to place anchors in frame units.
  const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
  const halfW = halfH * camera.aspect;
  const unit = Math.min(halfW, halfH);

  const geos: Array<() => BufferGeometry> = [
    () => new IcosahedronGeometry(1, 0),
    () => new OctahedronGeometry(1, 0),
    () => new DodecahedronGeometry(1, 0),
    () => new TorusGeometry(0.85, 0.32, 5, 10),
  ];
  const n = Math.max(2, Math.min(4, opts.count ?? 4));
  const spin = opts.spin ?? 1;
  const start = rng.int(0, 3);
  const shapes = Array.from({ length: n }, (_, i) => {
    const k = (start + i) % 4;
    const mesh = new Mesh(
      geos[k]!(),
      new MeshLambertMaterial({ color: new Color(PALETTE[k]!), flatShading: true }),
    );
    const [ax, ay] = ANCHORS[i]!;
    const size = unit * rng.range(0.2, 0.3);
    mesh.scale.setScalar(size);
    return {
      mesh,
      x: ax * halfW,
      y: ay * halfH,
      rx: rng.range(0.3, 0.8) * (rng.next() < 0.5 ? -1 : 1),
      ry: rng.range(0.4, 0.9) * (rng.next() < 0.5 ? -1 : 1),
      phase: rng.range(0, Math.PI * 2),
      bob: size * 0.25,
    };
  });
  for (const s of shapes) scene.add(s.mesh);

  tl.progress(0, { duration, ease: "none" }, (p) => {
    const t = p * duration;
    for (const [i, s] of shapes.entries()) {
      // Each shape eases in from slightly further away during the first 0.8 s.
      const intro = Math.min(1, t / 0.8);
      const e = 1 - (1 - intro) ** 3;
      s.mesh.rotation.set(s.phase + t * s.rx * spin, s.phase * 0.5 + t * s.ry * spin, 0);
      s.mesh.position.set(s.x, s.y + Math.sin(t * 1.3 + s.phase) * s.bob, -6 * (1 - e) - i * 0.3);
    }
    camera.position.x = Math.sin(t * 0.25) * 0.4;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  });
}
