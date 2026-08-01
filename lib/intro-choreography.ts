/**
 * The intro's single timeline.
 *
 * Both the WebGL stage and the DOM copy layers read these tracks, so the
 * almond and the text are choreographed against one clock instead of two
 * hand-tuned sets of numbers. Every value is a pure function of scroll
 * progress — nothing is stateful, so scrolling back up replays the
 * sequence exactly in reverse.
 *
 *   act 1  0.00 → 0.14   headline left, almond right
 *   T12    0.14 → 0.28   almond crosses to the left
 *   act 2  0.28 → 0.42   first editorial beat, copy right
 *   T23    0.42 → 0.60   almond sweeps back across the stage, in front of
 *                        the copy, wiping act 2 into act 3
 *   act 3  0.60 → 0.72   second editorial beat, copy left
 *   T34    0.72 → 0.82   almond centers and turns its seam to the audience
 *   act 4  0.82 → 1.00   the shell bursts, the halves are thrown clear of
 *                        the frame, and the green they uncover becomes
 *                        the ground the closing line arrives on
 */

export type Knots = ReadonlyArray<readonly [number, number]>;
export type Window = readonly [number, number];

/** Transition windows. The acts live in the gaps between them. */
export const T12: Window = [0.14, 0.28];
export const T23: Window = [0.42, 0.6];
export const T34: Window = [0.72, 0.82];

export function clamp01(x: number) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Piecewise track over scroll progress: smoothstep-eased between knots,
 * flat where consecutive knots repeat a value.
 */
export function sampleTrack(knots: Knots, p: number): number {
  const first = knots[0];
  if (p <= first[0]) return first[1];
  for (let i = 1; i < knots.length; i++) {
    const [p1, v1] = knots[i];
    if (p <= p1) {
      const [p0, v0] = knots[i - 1];
      const span = p1 - p0;
      const t = span <= 0 ? 1 : (p - p0) / span;
      const e = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * e;
    }
  }
  return knots[knots.length - 1][1];
}

/** Eased 0 → 1 across a transition window. */
export function windowProgress(p: number, [from, to]: Window) {
  return smoothstep(from, to, p);
}

/** Travel arc: 0 → 1 → 0 inside a window, 0 outside it. */
export function arc(p: number, [from, to]: Window) {
  if (p <= from || p >= to) return 0;
  return Math.sin(Math.PI * ((p - from) / (to - from)));
}

/**
 * Half-width of the soft band the wipe edge carries with it, in percent
 * of the viewport. Wide enough that the handoff reads as a dissolve
 * rather than a cut.
 */
export const WIPE_SOFTNESS = 8;

/**
 * The vertical seam the almond drags across the stage during act 2 → 3,
 * as a fraction of the viewport width. Copy to the right of it is still
 * act 2; copy to the left of it is already act 3.
 *
 * It matches the almond exactly at mid-crossing — the moment the divider
 * reads — and overshoots both frame edges at the ends of the window, so
 * act 2 is completely gone and act 3 completely present by the time the
 * almond parks. The almond itself can only travel between the two text
 * columns, which is why the seam runs slightly ahead of it early and
 * behind it late.
 */
export function textWipeEdge(p: number) {
  return -0.09 + 1.18 * windowProgress(p, T23);
}

/**
 * How far the halves have been thrown, 0 → 1, given the open value.
 *
 * Deliberately slow off the mark so the tease reads as a hairline crack,
 * then very fast: the shell does not swing open, it lets go.
 */
export function burst(open: number) {
  return smoothstep(0.05, 0.4, open);
}

/**
 * How much of the frame the uncovered green has taken, 0 → 1.
 *
 * Tied to the same curve as the halves and scaled so its edge sits on
 * their inner edge all the way out — the colour is not fading in behind
 * them, they are dragging it across the frame. It completes at the
 * moment they clear the edge, which is why nothing is left on screen by
 * the time the closing line starts to arrive.
 */
export function groundCover(open: number) {
  return clamp01(1.75 * burst(open));
}

/* ------------------------------------------------------------------ */
/* Almond tracks                                                       */
/* ------------------------------------------------------------------ */

export interface Stage {
  /** Almond X as a fraction of the viewport's half-width. */
  xFrac: Knots;
  /** Almond Y as a fraction of the viewport's half-height. */
  yFrac: Knots;
  /** How much the almond lifts as it crosses the stage. */
  crossLift: number;
  scale: Knots;
  /** Presentation yaw; -PI/2 turns the shell seam toward the audience. */
  spinY: Knots;
  roll: Knots;
  pitch: Knots;
  /** 0 closed → 1 burst wide open. */
  open: Knots;
  /** How far the halves are thrown, in local units. Well past the frame. */
  separation: number;
  camZ: Knots;
}

/**
 * Not quite edge-on. Turned the full ninety degrees the nut is at its
 * narrowest and reads as a leaf; held back to about two thirds it still
 * presents the seam to the audience but keeps the body of the almond.
 */
const SEAM_TURN = -1.12;

export const DESKTOP: Stage = {
  xFrac: [
    [0, 0.47], [0.14, 0.47], [0.28, -0.47], [0.42, -0.47],
    [0.6, 0.47], [0.72, 0.47], [0.82, 0], [1, 0],
  ],
  yFrac: [
    [0, -0.08], [0.72, -0.08], [0.82, -0.02], [1, -0.02],
  ],
  crossLift: 0.05,
  // A touch smaller on the far side for depth, then a grand scale-up
  scale: [
    [0, 0.94], [0.14, 0.94], [0.28, 0.86], [0.42, 0.86],
    [0.6, 0.94], [0.72, 0.94], [0.82, 1.16], [1, 1.18],
  ],
  // The almond shows a different face in each act, then squares its seam
  // to the audience for the opening
  spinY: [
    [0, -0.34], [0.14, -0.34], [0.28, 0.36], [0.42, 0.36],
    [0.6, -0.3], [0.72, -0.3], [0.82, SEAM_TURN], [1, SEAM_TURN],
  ],
  roll: [
    [0, -0.3], [0.14, -0.3], [0.28, -0.15], [0.42, -0.15],
    [0.6, -0.34], [0.72, -0.34], [0.82, -0.06], [1, -0.05],
  ],
  pitch: [
    [0, 0.12], [0.28, 0.16], [0.6, 0.1], [0.72, 0.1],
    [0.82, 0.04], [1, 0.03],
  ],
  // A hairline crack as a tease, a held breath, then the shell lets go
  // all at once — the halves are thrown clear of the frame in a beat
  open: [
    [0, 0], [0.775, 0], [0.8, 0.06], [0.808, 0.06], [0.868, 1], [1, 1],
  ],
  separation: 4.2,
  camZ: [
    [0, 5.6], [0.72, 5.6], [0.86, 5], [1, 5],
  ],
};

export const COMPACT: Stage = {
  ...DESKTOP,
  // Stacked staging: the almond parks below the copy and only rises into
  // it while it crosses, so nothing is ever buried under the sculpture
  xFrac: [
    [0, 0.3], [0.14, 0.3], [0.28, -0.3], [0.42, -0.3],
    [0.6, 0.3], [0.72, 0.3], [0.82, 0], [1, 0],
  ],
  // Parked low, clear of the copy and its buttons; it only rises into
  // the text while it is crossing, which is when it should be in the way
  yFrac: [
    [0, -0.62], [0.72, -0.62], [0.82, -0.02], [1, -0.02],
  ],
  crossLift: 0.42,
  scale: [
    [0, 0.46], [0.14, 0.46], [0.28, 0.43], [0.42, 0.43],
    [0.6, 0.46], [0.72, 0.46], [0.82, 0.72], [1, 0.74],
  ],
  separation: 2.6,
  camZ: [
    [0, 6.4], [0.72, 6.4], [0.86, 5.6], [1, 5.6],
  ],
};
