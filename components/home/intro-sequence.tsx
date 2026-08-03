"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionTemplate,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { intro } from "@/content/homepage";
import { routes } from "@/lib/site";
import {
  COMPACT,
  DESKTOP,
  WIPE_SOFTNESS,
  groundCover,
  sampleTrack,
  smoothstep,
  textWipeEdge,
} from "@/lib/intro-choreography";
import { AlmondFigure } from "@/components/home/almond-figure";
import almondPoster from "@/components/home/assets/almond-poster.png";
import {
  KabiaTransition,
  type VeilPhase,
} from "@/components/home/kabia-transition";

/**
 * Start fetching the scene the moment this module evaluates, rather than when
 * React gets around to mounting the component.
 *
 * `ssr: false` is deliberate — it is what puts the SVG almond in the server
 * HTML, so the hero is never empty. The cost is that Next emits no preload hint
 * for the scene chunk, so the browser cannot discover ~250 KB of three.js until
 * something asks for it. Left to `dynamic()` alone that request fires on mount,
 * which on a throttled phone measured ~3.0s in — about 1.5s after the page had
 * already finished hydrating, with the network sitting idle in between.
 *
 * Hoisting the `import()` to module scope starts it as soon as this chunk runs,
 * so the download overlaps hydration instead of queueing behind it. `dynamic()`
 * then just awaits the promise that is already in flight.
 *
 * Server-rendering the Canvas instead would also earn a preload, and was tried:
 * it moves the *canvas element* into the HTML but renders the SVG as canvas
 * fallback content, which browsers never paint. The hero ends up blank for the
 * whole download. Not worth ~400ms.
 */
if (
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 768px)").matches
) {
  // Warm the chunk, but only where it will actually be rendered. A phone never
  // shows the sculpture, so pulling ~250 KB of three.js down there would be
  // pure waste on the connection least able to afford it. The result is
  // discarded: `dynamic` below requests the same module and gets this one.
  void import("@/components/home/almond-scene");
}

const AlmondScene = dynamic(() => import("@/components/home/almond-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <AlmondFigure className="h-[62%] w-auto" />
    </div>
  ),
});

/* ------------------------------------------------------------------ */
/* Copy blocks (shared by the scroll story and the static fallback)    */
/* ------------------------------------------------------------------ */

function Act1Copy({ hot }: { hot: boolean }) {
  const { act1 } = intro;
  return (
    <div className="max-w-2xl">
      <p className="label text-olive">{act1.eyebrow}</p>
      <h1
        id="intro-heading"
        className="mt-7 text-[2.7rem] leading-[1.02] tracking-tight md:text-7xl lg:text-[5.2rem]"
      >
        {act1.headlineA}
        <br />
        <em className="font-theme-display italic text-brand">{act1.headlineB}</em>
      </h1>
      <p className="mt-8 max-w-lg text-base leading-relaxed text-ink/65 md:text-xl">
        {act1.supporting}
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-7">
        <a
          href={act1.primaryCta.href}
          tabIndex={hot ? 0 : -1}
          className="rounded-theme-button bg-brand px-8 py-4 text-sm font-medium text-on-brand transition-colors duration-300 hover:bg-forest"
        >
          {act1.primaryCta.label}
        </a>
        <a
          href={act1.secondaryCta.href}
          tabIndex={hot ? 0 : -1}
          className="group text-sm text-ink/70 transition-colors duration-300 hover:text-ink"
        >
          {act1.secondaryCta.label}
          <span
            aria-hidden="true"
            className="ml-2 inline-block transition-transform duration-300 group-hover:translate-x-1"
          >
            →
          </span>
        </a>
      </div>
    </div>
  );
}

/**
 * One letter of the closing line, rising out of its mask. Same gesture
 * as the brand word on the way to the store — each letter set going a
 * beat after the one before it — but driven by scroll rather than time,
 * so it reverses with the page.
 */
function RisingLetter({
  char,
  progress,
  start,
  span,
}: {
  char: string;
  progress: MotionValue<number>;
  start: number;
  span: number;
}) {
  const y = useTransform(
    progress,
    (v) => `${115 * (1 - smoothstep(start, start + span, v))}%`,
  );
  return (
    <motion.span className="inline-block whitespace-pre" style={{ y }}>
      {char === " " ? " " : char}
    </motion.span>
  );
}

/** A line of the closing statement, masked so the letters rise into it. */
function RisingLine({
  text,
  progress,
  from,
  step,
  span,
}: {
  text: string;
  progress: MotionValue<number>;
  from: number;
  step: number;
  span: number;
}) {
  return (
    <span className="flex justify-center overflow-hidden pb-[0.14em]">
      {[...text].map((char, i) => (
        <RisingLetter
          key={`${char}-${i}`}
          char={char}
          progress={progress}
          start={from + i * step}
          span={span}
        />
      ))}
    </span>
  );
}

/** Acts 2 and 3 share one editorial voice and differ only in content. */
function EditorialBeat({ kicker, text }: { kicker: string; text: string }) {
  return (
    <div className="max-w-xl">
      <p className="label text-olive">{kicker}</p>
      <p className="mt-6 font-theme-display text-[1.7rem] italic leading-[1.2] md:text-[2.3rem] md:leading-[1.16] lg:text-[2.7rem]">
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quiet variant                                                       */
/* ------------------------------------------------------------------ */

/** The same four beats as still sections: no stage, no WebGL, no scroll
 *  choreography. Kept as its own component so that for a visitor who
 *  asked for less motion none of that machinery is even mounted. */
function QuietIntro() {
  return (
    <section aria-labelledby="intro-heading">
      <div className="mx-auto max-w-[1200px] px-6 pt-28 md:px-10 md:pt-36">
        <Act1Copy hot />
        <div
          className="mt-12 flex justify-center pb-16"
          role="img"
          aria-label={intro.sceneDescription}
        >
          <AlmondFigure className="h-72 w-auto" />
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:px-10">
          <EditorialBeat kicker={intro.act2.kicker} text={intro.act2.text} />
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="mx-auto max-w-[1200px] px-6 py-16 md:px-10">
          <EditorialBeat kicker={intro.act3.kicker} text={intro.act3.text} />
        </div>
      </div>
      <div className="on-dark bg-forest">
        <div className="mx-auto max-w-[1200px] px-6 py-24 text-center md:px-10 md:py-32">
          <p className="font-theme-display text-[13vw] italic leading-none tracking-tight text-on-brand md:text-[7rem] lg:text-[9rem]">
            {intro.final.statementA}
            <br />
            {intro.final.statementB}
          </p>
          <div className="mt-10 md:mt-14">
            <Link
              href={routes.store}
              className="inline-block rounded-theme-button bg-on-brand px-10 py-4 text-sm font-medium text-forest transition-colors duration-300 hover:bg-cream"
            >
              {intro.final.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The 4-act scroll story                                              */
/* ------------------------------------------------------------------ */

/**
 * One tall scroll container, one sticky stage, one timeline (see
 * lib/intro-choreography). The 3D almond owns the space and travels
 * through it; the copy layers advance around it.
 *
 * Depth is deliberate. The editorial copy of acts 2 and 3 sits *behind*
 * the canvas, so when the almond sweeps back across the stage it passes
 * in front of the words as a real foreground object. It carries a soft
 * vertical seam with it: everything to its right is still act 2,
 * everything to its left is already act 3, and by the time it parks the
 * old thought is gone and the new one is standing on its own. The
 * headline and the closing statement sit in front of the canvas, where
 * legibility matters more than parallax.
 *
 * Act 4 turns the seam to the audience, bursts the shell out of frame
 * and lets the sheet that was balled up inside open out until it is the
 * screen — and the last line arrives on it.
 */
function ScrollIntro() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [viewportKnown, setViewportKnown] = useState(false);
  /** The sculpture is a wide-stage device only. */
  const showSculpture = viewportKnown && !compact;
  // Starts true (the intro is at the top on mount) so the render loop is
  // never gated on an IntersectionObserver's first callback.
  const [inView, setInView] = useState(true);
  const [act1Hot, setAct1Hot] = useState(true);
  const [ctaHot, setCtaHot] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  // The markers sit on ivory for three acts and on forest green for the last
  const [onDark, setOnDark] = useState(false);
  // True until the story is actually under way, so the header is there to
  // be used when the page opens and only steps aside once you commit
  const [atTop, setAtTop] = useState(true);
  const [veilPhase, setVeilPhase] = useState<VeilPhase>("off");
  // Flips once the sculpture has painted its first frame, which cross-fades the
  // static almond out. Not a ref: it drives a class, so it has to re-render.
  const [sceneReady, setSceneReady] = useState(false);
  const timers = useRef<number[]>([]);
  const router = useRouter();

  // Stable, and idempotent: ReadySignal fires once per mount, but a remount
  // (a resize that flips `compact`, say) would call it again on an already-true
  // state, and React bails out of a no-op setState rather than re-rendering.
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setCompact(query.matches);
      // Separate from `compact`, which starts false and so cannot distinguish
      // "wide" from "not measured yet". The sculpture must only mount once the
      // answer is known, or a phone would briefly satisfy the wide branch and
      // pull three.js down before the effect corrected it.
      setViewportKnown(true);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Once the story is under way the intro is full bleed and the header
  // gets out of the way. It stays put at the very top, where a visitor
  // who has just landed still needs it, and returns as soon as the page
  // proper begins.
  useEffect(() => {
    const root = document.documentElement;
    if (inView && !atTop) root.dataset.introStage = "on";
    else delete root.dataset.introStage;
    return () => {
      delete root.dataset.introStage;
    };
  }, [inView, atTop]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  // The store page should be ready the instant the veil completes
  useEffect(() => {
    router.prefetch(routes.store);
  }, [router]);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });

  /* Act 1 — leaves before the almond ever reaches it.
     Every ramp here is written as a function of progress rather than as
     an input/output range: the range form does not track this scroll
     value reliably on accelerated properties, and drifts. */
  const aOpacity = useTransform(scrollYProgress, (v) =>
    1 - smoothstep(0.08, 0.17, v),
  );
  /* ---------------------------------------------------------------- */
  /* The swept exit — phone only                                        */
  /*                                                                    */
  /* On a wide stage the almond does the clearing: it crosses the copy  */
  /* and the text gets out of its way sideways. With no sculpture on a  */
  /* phone that sideways move reads as text sliding into nothing, so    */
  /* the beats leave upward instead, narrowing as they go.              */
  /*                                                                    */
  /* The narrowing is what makes it a sweep rather than a scroll: the   */
  /* origin sits above the block, so width collapses toward a point off */
  /* the top of the screen and the line appears drawn up into it. Width */
  /* carries the gesture; the slight height squeeze only keeps the      */
  /* shape from looking stretched on the way out.                       */
  /* ---------------------------------------------------------------- */
  const SWEEP_RISE = 16; // vh
  const SWEEP_NARROW = 0.48; // scaleX travels 1 → 0.52
  const SWEEP_SQUEEZE = 0.14; // scaleY travels 1 → 0.86
  const SWEEP_ORIGIN = "50% -30%";

  /** 0 on a wide stage, so every sweep below collapses to a no-op there. */
  const sweptBy = useCallback(
    (v: number, from: number, to: number) =>
      compact ? smoothstep(from, to, v) : 0,
    [compact],
  );

  const aSweepY = useTransform(
    scrollYProgress,
    (v) => `${-SWEEP_RISE * sweptBy(v, 0.09, 0.19)}vh`,
  );
  const aSweepScaleX = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_NARROW * sweptBy(v, 0.09, 0.19),
  );
  const aSweepScaleY = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_SQUEEZE * sweptBy(v, 0.09, 0.19),
  );

  const aX = useTransform(scrollYProgress, (v) =>
    compact ? 0 : -56 * smoothstep(0.09, 0.19, v),
  );
  const aVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.175 ? "hidden" : "visible",
  );

  /* The seam the almond drags across the copy during act 2 → 3 */
  const wipeA = useTransform(
    scrollYProgress,
    (v) => textWipeEdge(v) * 100 - WIPE_SOFTNESS,
  );
  const wipeB = useTransform(
    scrollYProgress,
    (v) => textWipeEdge(v) * 100 + WIPE_SOFTNESS,
  );
  /* Act 2 survives only to the right of the seam… */
  const oldSeam = useMotionTemplate`linear-gradient(to right, transparent ${wipeA}%, #000 ${wipeB}%)`;
  /* …act 3 only to the left of it. */
  const newSeam = useMotionTemplate`linear-gradient(to right, #000 ${wipeA}%, transparent ${wipeB}%)`;
  /* One narrow column cannot be cut in two and still be read, so the
     phone gets the timing of the handoff without the seam. */
  const oldMask = compact ? "none" : oldSeam;
  const newMask = compact ? "none" : newSeam;

  /* On a wide stage the two beats hold their own columns and the seam
     alone separates them. In one narrow column they would leave
     fragments of both readable side by side, so there the old beat
     clears out before the new one arrives — behind the almond, which is
     centre stage at exactly that moment. */
  const bOut = compact ? 0.44 : 0.6;
  const cIn = compact ? 0.53 : 0.4;

  const bOpacity = useTransform(
    scrollYProgress,
    (v) => smoothstep(0.2, 0.27, v) * (1 - smoothstep(bOut, bOut + 0.07, v)),
  );
  /* Entry stays sideways on a wide stage, where the two beats occupy
     opposite columns and the direction says which one is arriving. Dead
     centre on a phone there is no such geography, so they rise in — the
     same axis they leave on, read backwards. */
  const bEnterX = useTransform(scrollYProgress, (v) =>
    compact ? 0 : 44 * (1 - smoothstep(0.2, 0.28, v)),
  );
  /* Arrival and departure share one axis on a phone, so they share one
     value: rises in from just below, then is drawn up and out. */
  const bY = useTransform(
    scrollYProgress,
    (v) =>
      `${
        (compact ? 6 : 0) * (1 - smoothstep(0.2, 0.28, v)) -
        SWEEP_RISE * sweptBy(v, bOut, bOut + 0.07)
      }vh`,
  );
  const bSweepScaleX = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_NARROW * sweptBy(v, bOut, bOut + 0.07),
  );
  const bSweepScaleY = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_SQUEEZE * sweptBy(v, bOut, bOut + 0.07),
  );
  const bVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.19 && v < bOut + 0.08 ? "visible" : "hidden",
  );

  const cOpacity = useTransform(
    scrollYProgress,
    (v) => smoothstep(cIn, cIn + 0.07, v) * (1 - smoothstep(0.745, 0.8, v)),
  );
  const cExitX = useTransform(scrollYProgress, (v) =>
    compact ? 0 : -44 * smoothstep(0.745, 0.8, v),
  );
  const cY = useTransform(
    scrollYProgress,
    (v) =>
      `${
        (compact ? 6 : 0) * (1 - smoothstep(cIn, cIn + 0.07, v)) -
        SWEEP_RISE * sweptBy(v, 0.745, 0.8)
      }vh`,
  );
  const cSweepScaleX = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_NARROW * sweptBy(v, 0.745, 0.8),
  );
  const cSweepScaleY = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_SQUEEZE * sweptBy(v, 0.745, 0.8),
  );
  const cVisibility = useTransform(scrollYProgress, (v) =>
    v > cIn - 0.01 && v < 0.805 ? "visible" : "hidden",
  );

  /* Act 4 — the ground behind the sculpture goes green along the line of
     the parting shells: the two halves sweep the ivory away with them,
     and what they uncover is the colour that was inside the almond. */
  const stage = compact ? COMPACT : DESKTOP;
  const groundEdge = useTransform(
    scrollYProgress,
    (v) => 50 * (1 - groundCover(sampleTrack(stage.open, v))),
  );
  const groundClip = useMotionTemplate`inset(0 ${groundEdge}% 0 ${groundEdge}%)`;
  const groundVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.785 ? "visible" : "hidden",
  );

  /* The line starts the moment the last shell is off the edge, which is
     also the moment the green completes — no waiting, and nothing left
     on screen for the letters to share it with. */
  const dVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.826 ? "visible" : "hidden",
  );
  const ctaOpacity = useTransform(scrollYProgress, (v) =>
    smoothstep(0.892, 0.915, v),
  );
  const ctaY = useTransform(
    scrollYProgress,
    (v) => 18 * (1 - smoothstep(0.892, 0.915, v)),
  );


  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setAtTop(v < 0.02);
    setAct1Hot(v < 0.16);
    setCtaHot(v > 0.909);
    setOnDark(v > 0.826);
    setActIndex(v < 0.21 ? 0 : v < 0.51 ? 1 : v < 0.78 ? 2 : 3);
  });

  const onKesfet = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // New-tab / download modifiers keep their default behavior
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (veilPhase !== "off") return;
    setVeilPhase("enter");
    timers.current.push(window.setTimeout(() => setVeilPhase("settle"), 1250));
    timers.current.push(
      window.setTimeout(() => router.push(routes.store), 1700),
    );
  };

  return (
    <section aria-labelledby="intro-heading">
      <div ref={wrapperRef} className="relative h-[540vh] md:h-[600vh]">
        <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden">
          {/* The ground the shell opens onto. It sits behind the canvas,
              so the halves fly across it and the sheet unfolds over it,
              and it is a plain panel — once the sheet has dissolved into
              it there is nothing left but flat colour. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 z-[5] bg-forest"
            style={{
              clipPath: groundClip,
              WebkitClipPath: groundClip,
              visibility: groundVisibility,
            }}
          />

          {/* Act 2 — behind the canvas, surviving only right of the seam */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              opacity: bOpacity,
              visibility: bVisibility,
              maskImage: oldMask,
              WebkitMaskImage: oldMask,
            }}
          >
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-center px-6 md:px-10">
              <motion.div
                style={{
                  x: bEnterX,
                  y: bY,
                  scaleX: bSweepScaleX,
                  scaleY: bSweepScaleY,
                  transformOrigin: SWEEP_ORIGIN,
                }}
                className="w-full text-center md:ml-auto md:w-[47%] md:pl-4 md:text-left lg:pl-10"
              >
                <EditorialBeat
                  kicker={intro.act2.kicker}
                  text={intro.act2.text}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* Act 3 — behind the canvas, arriving left of the seam */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-10"
            style={{
              opacity: cOpacity,
              visibility: cVisibility,
              maskImage: newMask,
              WebkitMaskImage: newMask,
            }}
          >
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-center px-6 md:px-10">
              <motion.div
                style={{
                  x: cExitX,
                  y: cY,
                  scaleX: cSweepScaleX,
                  scaleY: cSweepScaleY,
                  transformOrigin: SWEEP_ORIGIN,
                }}
                className="w-full text-center md:mr-auto md:w-[47%] md:pr-4 md:text-left lg:pr-10"
              >
                <EditorialBeat
                  kicker={intro.act3.kicker}
                  text={intro.act3.text}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* The 3D stage: one continuous shot across all four acts.
              Wide viewports only — a phone runs the same four beats as pure
              typography, so neither the sculpture nor its poster is rendered
              there, and the three.js chunk is never requested. `hidden md:block`
              rather than a `compact` check because this has to be in the server
              HTML for the poster to paint at first paint; the class settles the
              question before any JavaScript has an opinion. */}
          <div
            className="pointer-events-none absolute inset-0 z-20 hidden md:block"
            role="img"
            aria-label={intro.sceneDescription}
          >
            {/* The poster holds the frame until the sculpture is drawn.
                It is a sibling of the canvas rather than `dynamic`'s loading
                slot, because a loading slot is unmounted the moment the chunk
                arrives — a beat before WebGL has painted anything — which left
                the hero empty. Here the two cross-fade, so nothing pops in.

                The image is the sculpture's own first frame, captured off the
                canvas at act one with a transparent background, so the swap is
                between two versions of the same picture rather than between a
                drawing and a render. A hand-drawn stand-in never matched: its
                silhouette, shading and speckle were all visibly different, and
                the eye caught the change however well it was positioned.

                Sizing follows from the choreography rather than from taste. The
                camera's field of view is vertical, so the almond's projected
                height is a fixed share of the viewport height — 65.8% at
                DESKTOP scale 0.94 / camZ 5.6, and 28.2% at COMPACT 0.46 / 6.4,
                which is the same object roughly 43% as large. Centres likewise:
                xFrac and yFrac are fractions of the *half* viewport, so 0.47
                lands at 50% + 23.5%. All four numbers were then checked against
                the rendered frame. */}
            <div
              aria-hidden="true"
              className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                sceneReady ? "opacity-0" : "opacity-100"
              }`}
            >
              <Image
                src={almondPoster}
                alt=""
                aria-hidden="true"
                // The hero's first paint depends on this, so it is preloaded
                // rather than lazily discovered. Next serves AVIF/WebP from the
                // PNG source, which is why the wire cost is a fraction of it.
                priority
                // Statically imported so Next can derive the intrinsic size and
                // inline a blurred thumbnail. That thumbnail is what fills the
                // hero on a slow connection: measured on throttled 3G the full
                // poster lands ~850ms after first paint, and without this the
                // frame sat empty for that whole window — worse than the flat
                // SVG this replaced, which cost nothing because it was inline.
                placeholder="blur"
                // The phone never displays this, but the preload has no media
                // query, so it would still fetch something. Pointing the narrow
                // case at a thumbnail-sized candidate keeps that to a couple of
                // kilobytes instead of the full poster.
                sizes="(max-width: 767px) 16px, 66vh"
                className="absolute left-[73.7%] top-[48.6%] h-[65.8vh] w-auto -translate-x-1/2 -translate-y-1/2"
              />
            </div>

            {/* Gated in JavaScript, not CSS: `hidden` would still mount the
                component, and mounting it is what pulls three.js down. The
                wrapper above can stay in the markup because an image costs
                nothing once the media query has hidden it. */}
            {showSculpture && (
              <div
                className={`absolute inset-0 transition-opacity duration-700 ease-out motion-reduce:transition-none ${
                  sceneReady ? "opacity-100" : "opacity-0"
                }`}
              >
                <AlmondScene
                  progress={scrollYProgress}
                  active={inView}
                  compact={compact}
                  onReady={handleSceneReady}
                  fallback={
                    <div className="flex h-full w-full items-center justify-center">
                      <AlmondFigure className="h-[62%] w-auto" />
                    </div>
                  }
                />
              </div>
            )}
          </div>

          {/* Act 1 — copy left, almond right, in front for legibility */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-30"
            style={{ opacity: aOpacity, visibility: aVisibility }}
          >
            {/* The copy used to sit high on a phone to leave the lower third
                for the almond. With no sculpture there it takes the middle of
                the screen instead: centred as a block, but still ragged-right
                inside it, so the headline keeps its left edge to read down. */}
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-center px-6 md:justify-start md:px-10">
              <motion.div
                style={{
                  x: aX,
                  y: aSweepY,
                  scaleX: aSweepScaleX,
                  scaleY: aSweepScaleY,
                  transformOrigin: SWEEP_ORIGIN,
                }}
                className={`w-full max-w-md md:max-w-none ${
                  act1Hot ? "pointer-events-auto" : "pointer-events-none"
                }`}
              >
                <Act1Copy hot={act1Hot} />
              </motion.div>
            </div>
          </motion.div>

          {/* Act 4 — the closing line, in the voice the brand word uses */}
          <motion.div
            className="on-dark pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
            style={{ visibility: dVisibility }}
          >
            <p className="text-center font-theme-display text-[13vw] italic leading-none tracking-tight text-on-brand md:text-[7rem] lg:text-[9rem]">
              <RisingLine
                text={intro.final.statementA}
                progress={scrollYProgress}
                from={0.830}
                step={0.0022}
                span={0.022}
              />
              <span className="-mt-[0.16em] block">
                <RisingLine
                  text={intro.final.statementB}
                  progress={scrollYProgress}
                  from={0.854}
                  step={0.0022}
                  span={0.022}
                />
              </span>
            </p>
            <motion.div
              style={{ opacity: ctaOpacity, y: ctaY }}
              className="mt-10 md:mt-14"
            >
              <a
                href={routes.store}
                onClick={onKesfet}
                tabIndex={ctaHot ? 0 : -1}
                className={`inline-block rounded-theme-button bg-on-brand px-10 py-4 text-sm font-medium text-forest transition-colors duration-300 hover:bg-cream ${
                  ctaHot ? "pointer-events-auto" : "pointer-events-none"
                }`}
              >
                {intro.final.ctaLabel}
              </a>
            </motion.div>
          </motion.div>

          {/* Four acts, four quiet markers */}
          <div
            className="absolute bottom-8 right-6 z-40 flex items-center gap-2.5 md:right-10"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`block h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                  i === actIndex
                    ? onDark
                      ? "bg-on-brand"
                      : "bg-brand"
                    : onDark
                      ? "bg-on-brand/30"
                      : "bg-ink/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <KabiaTransition
        phase={veilPhase}
        word={intro.transitionWord}
        announcement={intro.transitionAnnouncement}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

const subscribeToMotionPreference = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Picks the variant. The preference is read through
 * useSyncExternalStore rather than at render time so the server and the
 * first client render agree — otherwise a visitor who prefers reduced
 * motion hydrates into a mismatch, and the scroll stage briefly mounts
 * with a target ref that was never rendered.
 */
export function IntroSequence() {
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    prefersReducedMotion,
    () => false,
  );
  return reduced ? <QuietIntro /> : <ScrollIntro />;
}
