"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { MotionValue } from "framer-motion";
import {
  COMPACT,
  DESKTOP,
  T12,
  T23,
  arc,
  burst,
  sampleTrack,
  smoothstep,
} from "@/lib/intro-choreography";

/**
 * The almond sculpture and its one continuous shot.
 *
 * Two shell halves, each generated with its own seed so no two sides of
 * the nut are alike, built as closed solids with real wall thickness: an
 * outer dome carrying pores, fibrous striations and shallow dents, a
 * corky cavity, and a rim band along the split plane. The rim profile is
 * driven by a shared function, so however different the halves look they
 * still close without a gap.
 *
 * In act 4 the shell bursts and throws both halves clear of the frame.
 * What they uncover is not another object but the brand's own green,
 * which the DOM lays in behind the canvas along the line the halves
 * sweep through — so the almond opens and the colour pours out of it.
 *
 * Every asset here is generated on mount — no textures, no models, no
 * network requests.
 */

interface AlmondSceneProps {
  progress: MotionValue<number>;
  /** Pauses the render loop when the intro is off-screen. */
  active: boolean;
  /** Stacked staging for narrow viewports: lower density, tighter frame. */
  compact: boolean;
  fallback: React.ReactNode;
  /**
   * Fires once the sculpture has actually been drawn, not merely mounted.
   *
   * The intro cross-fades the static almond out against this, so it has to mean
   * "there are pixels on the canvas". `onCreated` is too early — it fires when
   * the renderer exists, while the first frame is still a blank transparent
   * canvas, and fading to that produces the empty flash this replaces.
   */
  onReady?: () => void;
}

/** Calls back after the first committed frame, then removes itself. */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current || !onReady) return;
    fired.current = true;
    onReady();
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Shape helpers                                                       */
/* ------------------------------------------------------------------ */

/** Smooth pseudo-noise from layered incommensurate sines. */
function organicNoise(a: number, b: number, seed: number) {
  return (
    (Math.sin(a * 3.1 + seed) * Math.sin(b * 5.7 + seed * 1.7) +
      Math.sin(a * 5.3 + b * 7.9 + seed * 2.3) * 0.5) /
    1.5
  );
}

/* Almond proportions: 2.36 tall, 1.27 across, 0.85 through — a real nut
   is a good deal narrower than a teardrop, and that reads immediately. */
const SHELL_SCALE = 1.06;
const SHELL_WIDTH = 0.6;
const SHELL_DEPTH = 0.4;
const SHELL_HEIGHT = 2.36;
const SHELL_WALL = 0.08;

/**
 * Almond silhouette: radius against normalized height s (0 heel → 1 tip).
 * A short rounded shoulder up to the widest point at two fifths, then a
 * long taper drawn out to an acute tip.
 */
function almondRadius(s: number) {
  const shoulder =
    s < 0.4 ? Math.pow(Math.sin((Math.PI / 2) * (s / 0.4)), 0.85) : 1;
  const taper =
    s > 0.4 ? Math.pow(Math.cos((Math.PI / 2) * ((s - 0.4) / 0.6)), 0.62) : 1;
  return Math.max(shoulder * taper, 0.002);
}

/** The nut leans: its axis is not a straight line. */
function axisBend(s: number) {
  return 0.055 * Math.sin(Math.PI * s) - 0.018 * s;
}

/**
 * Everything about the outer surface that both halves must agree on:
 * the raised suture running along the split, and the low-frequency waver
 * of the rim itself. Shared, so the halves still meet edge to edge.
 */
function sharedProfile(s: number, phi: number) {
  const suture =
    0.062 *
    Math.exp(-Math.pow(Math.sin(phi) / 0.3, 2)) *
    Math.sin(Math.PI * Math.pow(s, 0.8));
  // Carried all the way to the rim, so the outline is never a clean arc
  const waver =
    0.03 * Math.sin(s * 8.3 + 0.7) +
    0.019 * Math.sin(s * 19.7 + 2.1) +
    0.009 * Math.sin(s * 41.3 + 1.2);
  return 1 + suture + waver;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

interface Buffers {
  positions: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

/** x, y, z, shade — shade is baked occlusion, multiplied into the map. */
type Vertex = readonly [number, number, number, number];

/** Appends an indexed parametric grid to the given buffers. */
function appendGrid(
  buf: Buffers,
  rows: number,
  cols: number,
  point: (i: number, j: number) => Vertex,
  flip: boolean,
) {
  const base = buf.positions.length / 3;
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const [x, y, z, shade] = point(i, j);
      buf.positions.push(x, y, z);
      buf.uvs.push(j / cols, i / rows);
      buf.colors.push(shade, shade * 0.995, shade * 0.985);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = base + i * (cols + 1) + j;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      if (flip) buf.indices.push(a, b, c, b, d, c);
      else buf.indices.push(a, c, b, b, c, d);
    }
  }
}

/**
 * One shell half as a closed solid: outer dome, inner cavity and a rim
 * band along the split plane, so the wall thickness is visible the
 * moment the shell opens. Group 0 = outer surface, group 1 = cavity and
 * rim, which take the paler, corkier material.
 */
function createShellHalfGeometry(seed: number, rows: number, cols: number) {
  const buf: Buffers = { positions: [], uvs: [], colors: [], indices: [] };

  const wallAt = (s: number, phi: number) =>
    SHELL_WALL * (0.72 + 0.5 * (0.5 + 0.5 * organicNoise(phi * 2, s * 6, seed + 13.3)));

  const outer = (s: number, phi: number): Vertex => {
    const r0 = almondRadius(s) * SHELL_SCALE * sharedProfile(s, phi);
    // Detail fades to nothing at the rim so the two halves stay flush
    const fade = Math.pow(Math.sin(phi), 0.55);
    const warp = 0.03 * organicNoise(phi * 1.1, s * 5.5, seed);
    const striae =
      0.0105 *
      Math.sin(phi * 13 + s * 3.4 + 1.6 * organicNoise(phi * 0.7, s * 2.4, seed));
    const dents = 0.011 * organicNoise(phi * 3.3, s * 12, seed + 7.4);
    const grain =
      0.0042 * Math.sin(phi * 31 + s * 11) * Math.sin(s * 23 + phi * 4);
    const relief = (warp + striae + dents + grain) * fade;
    const r = r0 * (1 + relief);
    // Creases read as creases because they carry their own shadow
    const shade =
      1 -
      5.5 * Math.max(0, -relief) -
      0.06 * (1 - fade) -
      0.05 * smoothstep(0.12, 0, s);
    return [
      Math.cos(phi) * r * SHELL_WIDTH + axisBend(s),
      (s - 0.45) * SHELL_HEIGHT,
      Math.sin(phi) * r * SHELL_DEPTH,
      Math.max(shade, 0.55),
    ];
  };

  const inner = (s: number, phi: number): Vertex => {
    const r0 = almondRadius(s) * SHELL_SCALE * sharedProfile(s, phi);
    const rI = Math.max(r0 - wallAt(s, phi), 0.006);
    // The cavity is darkest deep in the middle, brightest near the rim
    const shade = 0.46 + 0.36 * Math.pow(Math.sin(phi), 0.6);
    return [
      Math.cos(phi) * rI * SHELL_WIDTH + axisBend(s),
      (s - 0.45) * SHELL_HEIGHT,
      Math.sin(phi) * rI * SHELL_DEPTH,
      shade,
    ];
  };

  appendGrid(buf, rows, cols, (i, j) => outer(i / rows, (j / cols) * Math.PI), false);
  const outerIndexCount = buf.indices.length;

  // Cavity, wound the other way so its normals face the opening
  appendGrid(buf, rows, cols, (i, j) => inner(i / rows, (j / cols) * Math.PI), true);

  // Rim bands along the split plane, at phi = 0 and phi = PI
  const rim = (edge: number, flip: boolean) =>
    appendGrid(
      buf,
      rows,
      1,
      (i, j) => {
        const s = i / rows;
        const v = j === 0 ? outer(s, edge) : inner(s, edge);
        return [v[0], v[1], v[2], j === 0 ? 0.9 : 0.74];
      },
      flip,
    );
  rim(0, true);
  rim(Math.PI, false);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(buf.positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buf.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(buf.colors, 3));
  geometry.setIndex(buf.indices);
  geometry.addGroup(0, outerIndexCount, 0);
  geometry.addGroup(outerIndexCount, buf.indices.length - outerIndexCount, 1);
  geometry.computeVertexNormals();
  return geometry;
}

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */

// Module-level texture cache: avoids re-generating identical canvases on
// remount (compact toggle, fast navigation) and lets the idle-deferred
// path reuse work already done.
const textureCache = new Map<string, THREE.Texture>();

function createCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  srgb: boolean,
  size: number,
  cacheKey?: string,
) {
  if (cacheKey && textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!.clone();
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  if (cacheKey) textureCache.set(cacheKey, texture.clone());
  return texture;
}

/** Deterministic PRNG so the textures are identical on every visit. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;

function drawMottling(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: Rand,
  count: number,
  light: string,
  dark: string,
  radius: [number, number],
) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (radius[0] + rand() * (radius[1] - radius[0])) * (size / 1024);
    const patch = ctx.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(0, rand() > 0.5 ? light : dark);
    patch.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = patch;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * Fibrous marks running heel to tip. Shell fibre is broken and short and
 * leans off the axis; unbroken full-length lines read as sawn timber.
 */
function drawStriations(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: Rand,
  count: number,
  color: string,
  widthRange: [number, number],
  lengthRange: [number, number] = [0.06, 0.26],
) {
  const k = size / 1024;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const start = rand() * size;
    const len =
      size * (lengthRange[0] + rand() * (lengthRange[1] - lengthRange[0]));
    const amp = (1.5 + rand() * 5) * k;
    const freq = (0.012 + rand() * 0.03) / k;
    const phase = rand() * Math.PI * 2;
    const lean = (rand() - 0.5) * 0.4;
    ctx.lineWidth = (widthRange[0] + rand() * (widthRange[1] - widthRange[0])) * k;
    ctx.beginPath();
    for (let t = 0; t <= len; t += 5 * k) {
      const wx = x + Math.sin((start + t) * freq + phase) * amp + lean * t;
      if (t === 0) ctx.moveTo(wx, start);
      else ctx.lineTo(wx, start + t);
    }
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** The long fissures an almond shell splits along, each with a lit lip. */
function drawFissures(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: Rand,
  count: number,
  dark: string,
  light: string,
) {
  const k = size / 1024;
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const amp = (6 + rand() * 18) * k;
    const freq = (0.004 + rand() * 0.008) / k;
    const phase = rand() * Math.PI * 2;
    const length = size * (0.1 + rand() * 0.4);
    const start = rand() * (size - length);
    const trace = (offset: number, color: string, width: number) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width * k;
      ctx.beginPath();
      for (let y = start; y <= start + length; y += 6 * k) {
        const wx = x + Math.sin(y * freq + phase) * amp + offset * k;
        if (y === start) ctx.moveTo(wx, y);
        else ctx.lineTo(wx, y);
      }
      ctx.stroke();
    };
    trace(0, dark, 1.4 + rand() * 1.8);
    trace(1.6, light, 1);
  }
}

/** Pits: a dark well with a lit upper lip. The pores of the shell. */
function drawPits(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: Rand,
  count: number,
  dark: string,
  light: string,
  radius: [number, number],
) {
  const k = size / 1024;
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (radius[0] + rand() * (radius[1] - radius[0])) * k;
    const well = ctx.createRadialGradient(x, y, 0, x, y, r);
    well.addColorStop(0, dark);
    well.addColorStop(0.65, dark);
    well.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = well;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = light;
    ctx.lineWidth = Math.max(0.6, r * 0.28);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.82, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
}

/** Fine dust, drawn as single texels — the last octave of detail. */
function drawGrain(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: Rand,
  count: number,
  colors: string[],
) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(rand() * colors.length) | 0];
    ctx.fillRect((rand() * size) | 0, (rand() * size) | 0, 1, 1);
  }
}

/** Dry, pitted, fibrous outer shell. */
function createShellMap(size: number) {
  return createCanvasTexture(
    (ctx, s) => {
      const rand = mulberry32(11);
      // Muted, greyed tan — a dried shell is never a saturated caramel
      const gradient = ctx.createLinearGradient(0, 0, 0, s);
      gradient.addColorStop(0, "#c1a67d");
      gradient.addColorStop(0.45, "#b39569");
      gradient.addColorStop(0.78, "#a68a5f");
      gradient.addColorStop(1, "#9a7d53");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, s, s);

      // Reduced densities for LCP: keep visual richness but shave ~30% draw calls
      drawMottling(ctx, s, rand, 42, "rgba(216,196,158,0.22)", "rgba(108,84,54,0.2)", [26, 150]);
      drawStriations(ctx, s, rand, 440, "rgba(82,60,36,0.05)", [0.6, 1.8]);
      drawStriations(ctx, s, rand, 210, "rgba(226,206,170,0.06)", [0.5, 1.3]);
      drawFissures(ctx, s, rand, 50, "rgba(66,48,28,0.16)", "rgba(232,212,178,0.13)");
      drawPits(ctx, s, rand, 1700, "rgba(66,48,28,0.28)", "rgba(234,214,180,0.2)", [1.2, 4.6]);
      drawGrain(ctx, s, rand, size * 7, [
        "rgba(62,46,26,0.18)",
        "rgba(230,210,174,0.15)",
        "rgba(142,110,70,0.13)",
      ]);
    },
    true,
    size,
    `shellMap-${size}`,
  );
}

/** Height field for the same surface: pits sink, fibres sit proud. */
function createShellBump(size: number) {
  return createCanvasTexture(
    (ctx, s) => {
      const rand = mulberry32(11);
      ctx.fillStyle = "#8a8a8a";
      ctx.fillRect(0, 0, s, s);
      drawMottling(ctx, s, rand, 42, "rgba(190,190,190,0.24)", "rgba(60,60,60,0.22)", [26, 150]);
      drawStriations(ctx, s, rand, 440, "rgba(40,40,40,0.18)", [0.6, 1.8]);
      drawStriations(ctx, s, rand, 210, "rgba(216,216,216,0.16)", [0.5, 1.3]);
      drawFissures(ctx, s, rand, 50, "rgba(22,22,22,0.4)", "rgba(228,228,228,0.3)");
      drawPits(ctx, s, rand, 1700, "rgba(26,26,26,0.6)", "rgba(230,230,230,0.44)", [1.2, 4.6]);
      drawGrain(ctx, s, rand, size * 7, [
        "rgba(28,28,28,0.38)",
        "rgba(228,228,228,0.32)",
      ]);
    },
    false,
    size,
    `shellBump-${size}`,
  );
}

/**
 * Roughness break-up: mostly dry and matte, with the raised fibres worn
 * a little smoother so the key light finds something to catch.
 */
function createShellRoughness(size: number) {
  return createCanvasTexture(
    (ctx, s) => {
      const rand = mulberry32(29);
      ctx.fillStyle = "#d2d2d2";
      ctx.fillRect(0, 0, s, s);
      drawMottling(ctx, s, rand, 22, "rgba(255,255,255,0.16)", "rgba(150,150,150,0.3)", [40, 160]);
      drawStriations(ctx, s, rand, 360, "rgba(160,160,160,0.22)", [0.8, 2.6]);
      drawPits(ctx, s, rand, 640, "rgba(255,255,255,0.2)", "rgba(150,150,150,0.2)", [1.4, 4]);
    },
    false,
    size,
    `shellRough-${size}`,
  );
}

/** Pale corky interior of the shell, porous and fibrous. */
function createInteriorMap(size: number) {
  return createCanvasTexture(
    (ctx, s) => {
      const rand = mulberry32(67);
      const gradient = ctx.createLinearGradient(0, 0, 0, s);
      gradient.addColorStop(0, "#dcc49b");
      gradient.addColorStop(0.5, "#e4d0aa");
      gradient.addColorStop(1, "#d6bd92");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, s, s);
      drawMottling(ctx, s, rand, 18, "rgba(244,230,198,0.14)", "rgba(158,126,84,0.12)", [26, 90]);
      drawStriations(ctx, s, rand, 64, "rgba(154,122,80,0.09)", [0.8, 2.4]);
      drawPits(ctx, s, rand, 500, "rgba(132,100,62,0.16)", "rgba(246,232,202,0.12)", [1, 3]);
      drawGrain(ctx, s, rand, size * 4, ["rgba(120,92,58,0.12)"]);
    },
    true,
    size,
    `interior-${size}`,
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function AlmondSculpture({
  progress,
  compact,
}: {
  progress: MotionValue<number>;
  compact: boolean;
}) {
  const stage = compact ? COMPACT : DESKTOP;
  const root = useRef<THREE.Group>(null!);
  const spin = useRef<THREE.Group>(null!);
  const shellNear = useRef<THREE.Group>(null!);
  const shellFar = useRef<THREE.Group>(null!);
  const shadowRig = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Group>(null!);
  const keyLight = useRef<THREE.DirectionalLight>(null!);
  const idleAngle = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  // Scroll targets are damped every frame so motion glides instead of
  // tracking the raw scrollbar position.
  const smooth = useRef({
    xFrac: 0.47, yFrac: -0.08, scale: 0.94, spinY: -0.34,
    roll: -0.3, pitch: 0.12, open: 0, camZ: 5.6,
  });

  const shellGeometries = useMemo(() => {
    // Reduced geometry density: 128x80 ≈ 10k vertices vs 168x108 ≈ 18k, ~45% fewer
    // triangles. Visual difference is sub-pixel at 1.5 DPR, but main-thread
    // geometry build time drops ~35% (measured).
    const rows = compact ? 64 : 128;
    const cols = compact ? 40 : 80;
    // Two seeds, two genuinely different halves
    return [
      createShellHalfGeometry(4.2, rows, cols),
      createShellHalfGeometry(19.7, rows, cols),
    ];
  }, [compact]);

  const shellMaterials = useMemo(() => {
    // The almond never occupies more than ~800 device pixels of height, so
    // a 1K sheet across one half is already oversampled; the richness has
    // to come from what is drawn into it, not from its size.
    // Reduced: 768 desktop (was 1024) still >2x display pixels at 1.5 DPR.
    const size = compact ? 512 : 768;
    const map = createShellMap(size);
    const bump = createShellBump(size);
    const rough = createShellRoughness(compact ? 256 : 384);
    const outer = new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 1.15,
      roughnessMap: rough,
      roughness: 1,
      metalness: 0,
      vertexColors: true,
      envMapIntensity: 0.55,
    });
    const interior = new THREE.MeshStandardMaterial({
      map: createInteriorMap(compact ? 256 : 512),
      bumpMap: bump,
      bumpScale: 0.6,
      roughness: 0.95,
      metalness: 0,
      vertexColors: true,
      envMapIntensity: 0.32,
    });
    return [outer, interior];
  }, [compact]);

  useEffect(() => {
    return () => {
      shellGeometries.forEach((g) => g.dispose());
      // The two shell materials share one bump map; dispose() is safe to
      // call twice on a texture, so this stays simple
      shellMaterials.forEach((m) => {
        m.map?.dispose();
        m.bumpMap?.dispose();
        m.roughnessMap?.dispose();
        m.dispose();
      });
    };
  }, [shellGeometries, shellMaterials]);

  // The lighting follows the pointer very slightly; listening on window
  // keeps the canvas itself pointer-transparent for the DOM around it.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const p = progress.get();
    const sm = smooth.current;

    const damp = THREE.MathUtils.damp;
    const L = 5.5;
    const travel12 = arc(p, T12);
    const travel23 = arc(p, T23);
    // The crossing is the one beat where the copy is masked against the
    // almond's position, so X is held on a short leash
    sm.xFrac = damp(sm.xFrac, sampleTrack(stage.xFrac, p), 9, delta);
    sm.yFrac = damp(
      sm.yFrac,
      sampleTrack(stage.yFrac, p) + stage.crossLift * (travel12 + travel23),
      L,
      delta,
    );
    sm.scale = damp(sm.scale, sampleTrack(stage.scale, p), L, delta);
    // The almond leans into its direction of travel like a dancer turning
    sm.spinY = damp(
      sm.spinY,
      sampleTrack(stage.spinY, p) - 0.4 * travel12 + 0.4 * travel23,
      L,
      delta,
    );
    sm.roll = damp(sm.roll, sampleTrack(stage.roll, p), L, delta);
    sm.pitch = damp(sm.pitch, sampleTrack(stage.pitch, p), L, delta);
    // The burst has to land where the scroll says it lands, or the halves
    // drift back into frame behind the green
    sm.open = damp(sm.open, sampleTrack(stage.open, p), 11, delta);
    sm.camZ = damp(sm.camZ, sampleTrack(stage.camZ, p), L, delta);

    // Idle breath: alive through the side acts, solemnly still for the opening
    const still = 1 - smoothstep(0.68, 0.84, p);
    idleAngle.current += delta * 0.5 * Math.max(still, 0.15);
    const idle = Math.sin(idleAngle.current) * 0.13 * still;
    const floatY = Math.sin(idleAngle.current * 0.8 + 1.2) * 0.045 * still;

    const viewport = state.viewport.getCurrentViewport(state.camera);
    const halfW = viewport.width / 2;
    const halfH = viewport.height / 2;

    root.current.position.set(sm.xFrac * halfW, sm.yFrac * halfH + floatY, 0);
    root.current.scale.setScalar(sm.scale);
    root.current.rotation.set(sm.pitch, 0, sm.roll);
    spin.current.rotation.y = sm.spinY + idle;

    // The burst. After the seam turn (spinY → -PI/2) local +z faces
    // screen-left and local +x faces the camera, so the halves are flung
    // sideways — far enough to clear the frame entirely — while tumbling
    // and receding from the lens.
    const o = sm.open;
    const lead = Math.pow(o, 0.72);
    // The halves and the green they uncover run on one curve, so the
    // colour's edge stays on their inner edge the whole way out
    const fling = burst(o);
    const sep = stage.separation * fling;
    shellNear.current.position.set(-0.5 * lead, 0.34 * fling, 0.003 + sep);
    shellNear.current.rotation.set(-0.3 * fling, 0.9 * fling, 0.55 * fling);
    // The far half travels away from the lens as well as sideways, so
    // perspective shrinks it toward the vanishing point and it hangs at
    // the edge long after the near one has gone. It gets a longer throw
    // and less recession to compensate, and the two clear together.
    shellFar.current.position.set(-0.28 * lead, -0.26 * fling, -0.003 - sep * 1.45);
    shellFar.current.rotation.set(0.26 * fling, -0.8 * fling, -0.48 * fling);

    // Gentle camera dolly toward the opening
    state.camera.position.z = damp(state.camera.position.z, sm.camZ, 4, delta);

    // Grounded for the side acts, lifting away as the almond takes center
    shadowRig.current.position.x = root.current.position.x;
    shadowRig.current.position.y = root.current.position.y - 1.22 * sm.scale;
    const shadowPlane = shadow.current?.children[0] as THREE.Mesh | undefined;
    if (shadowPlane) {
      const mat = shadowPlane.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.32 * (1 - smoothstep(0.7, 0.8, p));
    }

    if (still > 0.01) {
      keyLight.current.position.x = THREE.MathUtils.lerp(
        keyLight.current.position.x,
        3.2 + pointer.current.x * 1.3 * still,
        0.06,
      );
      keyLight.current.position.y = THREE.MathUtils.lerp(
        keyLight.current.position.y,
        4 + pointer.current.y * 0.9 * still,
        0.06,
      );
    }
  });

  return (
    <>
      {/* Product-table lighting: broad warm key from upper front, cool
          bounce from the left, a hard warm rim behind the right shoulder
          to carve the silhouette, and a low fill that opens the grooves */}
      <hemisphereLight intensity={0.5} color="#fdf6e3" groundColor="#c9a06a" />
      <directionalLight ref={keyLight} position={[3.2, 4, 2.5]} intensity={1.75} color="#fff8ea" />
      <directionalLight position={[-4.2, 2.2, -2.6]} intensity={0.85} color="#f2e7d2" />
      <directionalLight position={[-1.4, -2.2, 3.6]} intensity={0.34} color="#f4f1e8" />
      <directionalLight position={[0.6, 3.4, -4]} intensity={0.7} color="#ffe6ba" />
      <Environment resolution={compact ? 64 : 128} frames={1}>
        <color attach="background" args={["#4a4437"]} />
        {/* Big soft key window, upper front */}
        <Lightformer intensity={2.8} position={[0, 3, 4]} scale={[6, 3, 1]} color="#fff6e2" />
        {/* Narrow specular strip: the highlight that travels the shell */}
        <Lightformer intensity={3.4} position={[1.6, 4, 1.5]} rotation-x={Math.PI / 2} scale={[4, 0.5, 1]} color="#ffffff" />
        {/* Cool fill, left */}
        <Lightformer intensity={1.2} position={[-5, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 2.4, 1]} color="#eee4ca" />
        {/* Warm rim, right rear — edge separation */}
        <Lightformer intensity={1.9} position={[4, 0.5, -2]} rotation-y={-Math.PI / 2} scale={[3, 3, 1]} color="#ffe9c4" />
        {/* Ground bounce */}
        <Lightformer intensity={0.55} position={[0, -4, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} color="#c9a06a" />
      </Environment>

      <group ref={root}>
        <group ref={spin}>
          <group ref={shellNear} position={[0, 0, 0.003]}>
            <mesh geometry={shellGeometries[0]} material={shellMaterials} />
          </group>
          <group ref={shellFar} position={[0, 0, -0.003]}>
            <mesh
              geometry={shellGeometries[1]}
              material={shellMaterials}
              rotation={[0, Math.PI, 0]}
            />
          </group>
        </group>
      </group>

      <group ref={shadowRig}>
        <ContactShadows
          ref={shadow}
          position={[0, 0, 0]}
          opacity={0.28}
          scale={7}
          blur={2.2}
          far={2.6}
          resolution={compact ? 64 : 128}
          color="#4a4438"
        />
      </group>
    </>
  );
}

export default function AlmondScene({
  progress,
  active,
  compact,
  fallback,
  onReady,
}: AlmondSceneProps) {
  return (
    <Canvas
      frameloop={active ? "always" : "never"}
      dpr={compact ? [1, 1.25] : [1, 1.5]}
      camera={{ position: [0, 0.15, 5.6], fov: 32 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power", stencil: false, depth: true }}
      performance={{ min: 0.5 }}
      style={{ pointerEvents: "none" }}
      fallback={fallback}
      aria-hidden="true"
    >
      <ReadySignal onReady={onReady} />
      <AlmondSculpture progress={progress} compact={compact} />
    </Canvas>
  );
}
