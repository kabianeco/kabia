"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { smoothstep } from "@/lib/intro-choreography";
import {
  KabiaTransition,
  type VeilPhase,
} from "@/components/home/kabia-transition";

/** The looping field footage the whole intro is staged on. */
const HERO_VIDEO = "/video/kabia-hero.mp4";
const HERO_VIDEO_AV1 = "/video/kabia-hero.av1.mp4";
const HERO_POSTER = "/video/kabia-hero-poster.jpg";

/* ------------------------------------------------------------------ */
/* Copy blocks (shared by the scroll story and the static fallback)    */
/* ------------------------------------------------------------------ */

function Act1Copy({ hot }: { hot: boolean }) {
  const { act1 } = intro;
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="label text-cream">{act1.eyebrow}</p>
      <h1
        id="intro-heading"
        className="mt-7 text-[2.7rem] leading-[1.02] tracking-tight text-on-brand md:text-7xl lg:text-[5.2rem]"
      >
        {act1.headlineA}
        <br />
        <em className="font-theme-display italic text-cream">{act1.headlineB}</em>
      </h1>
      <p className="mx-auto mt-8 max-w-lg text-base leading-relaxed text-on-brand/75 md:text-xl">
        {act1.supporting}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-7">
        <a
          href={act1.primaryCta.href}
          tabIndex={hot ? 0 : -1}
          className="rounded-theme-button bg-on-brand px-8 py-4 text-sm font-medium text-forest transition-colors duration-300 hover:bg-cream"
        >
          {act1.primaryCta.label}
        </a>
        <a
          href={act1.secondaryCta.href}
          tabIndex={hot ? 0 : -1}
          className="group text-sm text-on-brand/75 transition-colors duration-300 hover:text-on-brand"
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
      {char === " " ? " " : char}
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
    <div className="mx-auto max-w-xl text-center">
      <p className="label text-cream">{kicker}</p>
      <p className="mt-6 font-theme-display text-[1.7rem] italic leading-[1.2] text-on-brand md:text-[2.3rem] md:leading-[1.16] lg:text-[2.7rem]">
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The stage backdrop                                                  */
/* ------------------------------------------------------------------ */

/**
 * The footage every act is staged on, plus the veil that makes the copy
 * readable over it.
 *
 * `poster` is what paints at first paint — it is a still of the video's
 * own first frame, so the swap to moving footage is between two versions
 * of the same picture and never pops. Playback is tied to `active` so the
 * loop stops decoding frames once the intro has scrolled away.
 *
 * The veil is two layers on purpose: a flat forest wash sets the contrast
 * floor for the copy, and a vertical gradient darkens the top and bottom
 * where the header and the act markers sit.
 */
function StageBackdrop({ active }: { active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // §5.5: the poster paints first and the footage starts only after the page
  // has loaded, so the video download never competes with LCP. The poster is
  // a still of the video's own first frame, so the handoff is between two
  // versions of the same picture and never pops.
  const [pageLoaded, setPageLoaded] = useState(
    () => typeof document !== "undefined" && document.readyState === "complete",
  );

  useEffect(() => {
    // Read inside a callback, not the effect body: the load event may fire
    // between the lazy initializer above and this effect on a fast load.
    const syncFromReadyState = () => {
      if (document.readyState === "complete") setPageLoaded(true);
    };
    syncFromReadyState();
    window.addEventListener("load", syncFromReadyState);
    return () => window.removeEventListener("load", syncFromReadyState);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active && pageLoaded) {
      // Autoplay can still be refused (low power mode, a browser setting).
      // The poster stays behind the element, so a rejection is invisible.
      void el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active, pageLoaded]);

  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        poster={HERO_POSTER}
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
      >
        {/* AV1 first, H.264 as the fallback, per breakpoint: a browser that
            cannot decode AV1 skips those entries on their type. Same footage,
            same frames — the AV1 files are the same loop at a fraction of the
            bytes. */}
        <source src="/video/kabia-hero-mobile.av1.mp4" media="(max-width: 768px)" type={'video/mp4; codecs="av01.0.04M.08"'} />
        <source src="/video/kabia-hero-mobile.mp4" media="(max-width: 768px)" type="video/mp4" />
        <source src={HERO_VIDEO_AV1} media="(min-width: 769px)" type={'video/mp4; codecs="av01.0.05M.08"'} />
        <source src={HERO_VIDEO} media="(min-width: 769px)" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-forest/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-forest/55 via-transparent to-forest/65" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quiet variant                                                       */
/* ------------------------------------------------------------------ */

/** The same four beats as still sections: no stage, no playback, no
 *  scroll choreography. Kept as its own component so that for a visitor
 *  who asked for less motion none of that machinery is even mounted —
 *  the footage appears only as its own still frame. */
function QuietIntro() {
  return (
    <section aria-labelledby="intro-heading" className="on-dark">
      <div className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-forest bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_POSTER})` }}
        />
        {/* Heavier than the scroll stage's wash: this is one still frame with
            the copy sitting straight on it, and no gradient underneath it to
            pick up the top and bottom. */}
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-forest/50" />
        <div className="mx-auto max-w-[1200px] px-6 pb-24 pt-28 md:px-10 md:pb-32 md:pt-36">
          <Act1Copy hot />
        </div>
      </div>
      <div className="bg-forest">
        <div className="mx-auto max-w-[1200px] px-6 py-12 md:px-10 md:py-14">
          <EditorialBeat kicker={intro.act2.kicker} text={intro.act2.text} />
        </div>
      </div>
      <div className="border-t border-on-brand/10 bg-forest">
        <div className="mx-auto max-w-[1200px] px-6 py-12 md:px-10 md:py-14">
          <EditorialBeat kicker={intro.act3.kicker} text={intro.act3.text} />
        </div>
      </div>
      <div className="border-t border-on-brand/10 bg-forest">
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center md:px-10 md:py-24">
          <p className="font-theme-display text-[13vw] italic leading-none tracking-tight text-on-brand md:text-[7rem] lg:text-[9rem]">
            {intro.final.statementA}
            <br />
            {intro.final.statementB}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The 4-act scroll story                                              */
/* ------------------------------------------------------------------ */

/**
 * One tall scroll container, one sticky stage, one timeline. The looping
 * footage holds the frame for the whole sequence and the copy layers
 * advance over it, each beat centred on the screen and handed to the next.
 *
 * Every beat leaves the way it arrives, on the vertical: the transform
 * origin sits above the block, so width collapses toward a point off the
 * top of the screen and the line reads as drawn up out of frame rather
 * than merely scrolled past.
 *
 * Act 4 closes the film down — forest green opens from the centre of the
 * frame until it has covered the footage, and the last line arrives on it.
 */
function ScrollIntro() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  // Starts true (the intro is at the top on mount) so playback is never
  // gated on an IntersectionObserver's first callback.
  const [inView, setInView] = useState(true);
  const [act1Hot, setAct1Hot] = useState(true);
  const [ctaHot, setCtaHot] = useState(false);
  const [actIndex, setActIndex] = useState(0);
  // True until the story is actually under way, so the header is there to
  // be used when the page opens and only steps aside once you commit
  const [atTop, setAtTop] = useState(true);
  const [veilPhase, setVeilPhase] = useState<VeilPhase>("off");
  const timers = useRef<number[]>([]);
  const router = useRouter();

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

  // The store page should be ready the instant the veil completes.
  // Deferred to idle so it does not compete with LCP (poster + fonts).
  useEffect(() => {
    const schedule =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout: number }) => number)
        | undefined;
    const doPrefetch = () => router.prefetch(routes.store);
    if (schedule) {
      const id = schedule(doPrefetch, { timeout: 3000 });
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cancel = (window as any).cancelIdleCallback as
          | ((id: number) => void)
          | undefined;
        if (cancel) cancel(id);
      };
    }
    const t = window.setTimeout(doPrefetch, 1500);
    return () => window.clearTimeout(t);
  }, [router]);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start start", "end end"],
  });

  /* ---------------------------------------------------------------- */
  /* The swept exit                                                     */
  /*                                                                    */
  /* Every beat is centred, so there is no left/right geography to send  */
  /* it out on — it leaves upward instead, narrowing as it goes.         */
  /*                                                                    */
  /* The narrowing is what makes it a sweep rather than a scroll: the    */
  /* origin sits above the block, so width collapses toward a point off  */
  /* the top of the screen and the line appears drawn up into it. Width  */
  /* carries the gesture; the slight height squeeze only keeps the       */
  /* shape from looking stretched on the way out.                        */
  /* ---------------------------------------------------------------- */
  const SWEEP_RISE = 16; // vh
  const SWEEP_NARROW = 0.48; // scaleX travels 1 → 0.52
  const SWEEP_SQUEEZE = 0.14; // scaleY travels 1 → 0.86
  const SWEEP_ORIGIN = "50% -30%";
  /* Arrival is the same axis read backwards: each beat rises in from
     just below centre before it is drawn up and out. */
  const ENTER_RISE = 6; // vh

  /* Act 1 — leaves before the first editorial beat arrives.
     Every ramp here is written as a function of progress rather than as
     an input/output range: the range form does not track this scroll
     value reliably on accelerated properties, and drifts. */
  const aOpacity = useTransform(scrollYProgress, (v) =>
    1 - smoothstep(0.08, 0.17, v),
  );
  const aSweepY = useTransform(
    scrollYProgress,
    (v) => `${-SWEEP_RISE * smoothstep(0.09, 0.19, v)}vh`,
  );
  const aSweepScaleX = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_NARROW * smoothstep(0.09, 0.19, v),
  );
  const aSweepScaleY = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_SQUEEZE * smoothstep(0.09, 0.19, v),
  );
  const aVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.175 ? "hidden" : "visible",
  );

  /* One centred column cannot hold two beats at once, so the old one
     clears the frame before the new one arrives. The holds between beats
     are deliberately short: each beat arrives, lands for a breath, and is
     drawn up — the old timing left long stretches where only the footage
     moved. */
  const bOut = 0.36;
  const cIn = 0.45;
  const cOut = 0.63;

  const bOpacity = useTransform(
    scrollYProgress,
    (v) => smoothstep(0.18, 0.25, v) * (1 - smoothstep(bOut, bOut + 0.07, v)),
  );
  const bY = useTransform(
    scrollYProgress,
    (v) =>
      `${
        ENTER_RISE * (1 - smoothstep(0.18, 0.26, v)) -
        SWEEP_RISE * smoothstep(bOut, bOut + 0.07, v)
      }vh`,
  );
  const bSweepScaleX = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_NARROW * smoothstep(bOut, bOut + 0.07, v),
  );
  const bSweepScaleY = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_SQUEEZE * smoothstep(bOut, bOut + 0.07, v),
  );
  const bVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.17 && v < bOut + 0.08 ? "visible" : "hidden",
  );

  const cOpacity = useTransform(
    scrollYProgress,
    (v) => smoothstep(cIn, cIn + 0.07, v) * (1 - smoothstep(cOut, cOut + 0.06, v)),
  );
  const cY = useTransform(
    scrollYProgress,
    (v) =>
      `${
        ENTER_RISE * (1 - smoothstep(cIn, cIn + 0.07, v)) -
        SWEEP_RISE * smoothstep(cOut, cOut + 0.06, v)
      }vh`,
  );
  const cSweepScaleX = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_NARROW * smoothstep(cOut, cOut + 0.06, v),
  );
  const cSweepScaleY = useTransform(
    scrollYProgress,
    (v) => 1 - SWEEP_SQUEEZE * smoothstep(cOut, cOut + 0.06, v),
  );
  const cVisibility = useTransform(scrollYProgress, (v) =>
    v > cIn - 0.01 && v < cOut + 0.07 ? "visible" : "hidden",
  );

  /* Act 4 — forest green opens from the centre of the frame until it has
     covered the footage, and the closing line arrives on it. */
  const groundEdge = useTransform(
    scrollYProgress,
    (v) => 50 * (1 - smoothstep(0.66, 0.72, v)),
  );
  const groundClip = useMotionTemplate`inset(0 ${groundEdge}% 0 ${groundEdge}%)`;
  const groundVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.655 ? "visible" : "hidden",
  );

  /* The line starts the moment the green completes — nothing left on
     screen for the letters to share it with. */
  const dVisibility = useTransform(scrollYProgress, (v) =>
    v > 0.715 ? "visible" : "hidden",
  );
  const ctaOpacity = useTransform(scrollYProgress, (v) =>
    smoothstep(0.8, 0.83, v),
  );
  const ctaY = useTransform(
    scrollYProgress,
    (v) => 18 * (1 - smoothstep(0.8, 0.83, v)),
  );

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setAtTop(v < 0.02);
    setAct1Hot(v < 0.15);
    setCtaHot(v > 0.825);
    setActIndex(v < 0.19 ? 0 : v < 0.43 ? 1 : v < 0.66 ? 2 : 3);
  });

  const onKesfet = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // New-tab / download modifiers keep their default behavior
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (veilPhase !== "off") return;
    // "Önce üretici": the veil lifts onto the producers strip, not the store.
    setVeilPhase("enter");
    timers.current.push(window.setTimeout(() => setVeilPhase("settle"), 1250));
    timers.current.push(
      window.setTimeout(() => router.push("/#ureticiler"), 1700),
    );
  };

  return (
    <section aria-labelledby="intro-heading" className="on-dark">
      {/* Four beats, one breath each: the run is a third shorter than the
           sculpture era, and the holds between beats are tight — the story
           lands its atmosphere, then hands the visitor to the products
           instead of dwelling on the same feeling twice. */}
      <div ref={wrapperRef} className="relative h-[280vh] md:h-[300vh]">
        <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden">
          <StageBackdrop active={inView} />

          {/* The ground the film closes onto — a plain panel, so once the
              green has completed there is nothing left but flat colour. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 z-[5] bg-forest"
            style={{
              clipPath: groundClip,
              WebkitClipPath: groundClip,
              visibility: groundVisibility,
            }}
          />

          {/* Act 1 — the headline, centred on the footage */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-30"
            style={{ opacity: aOpacity, visibility: aVisibility, willChange: "opacity" } as never}
          >
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-center px-6 md:px-10">
              <motion.div
                style={{
                  y: aSweepY,
                  scaleX: aSweepScaleX,
                  scaleY: aSweepScaleY,
                  transformOrigin: SWEEP_ORIGIN,
                  willChange: "transform",
                } as never}
                className={`w-full ${
                  act1Hot ? "pointer-events-auto" : "pointer-events-none"
                }`}
              >
                <Act1Copy hot={act1Hot} />
              </motion.div>
            </div>
          </motion.div>

          {/* Act 2 */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-30"
            style={{
              opacity: bOpacity,
              visibility: bVisibility,
              willChange: "opacity",
            } as never}
          >
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-center px-6 md:px-10">
              <motion.div
                style={{
                  y: bY,
                  scaleX: bSweepScaleX,
                  scaleY: bSweepScaleY,
                  transformOrigin: SWEEP_ORIGIN,
                  willChange: "transform",
                } as never}
                className="w-full"
              >
                <EditorialBeat
                  kicker={intro.act2.kicker}
                  text={intro.act2.text}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* Act 3 */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-30"
            style={{
              opacity: cOpacity,
              visibility: cVisibility,
              willChange: "opacity",
            } as never}
          >
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-center px-6 md:px-10">
              <motion.div
                style={{
                  y: cY,
                  scaleX: cSweepScaleX,
                  scaleY: cSweepScaleY,
                  transformOrigin: SWEEP_ORIGIN,
                  willChange: "transform",
                } as never}
                className="w-full"
              >
                <EditorialBeat
                  kicker={intro.act3.kicker}
                  text={intro.act3.text}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* Act 4 — the closing line, in the voice the brand word uses */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center px-6"
            style={{ visibility: dVisibility }}
          >
            <p className="text-center font-theme-display text-[13vw] italic leading-none tracking-tight text-on-brand md:text-[7rem] lg:text-[9rem]">
              <RisingLine
                text={intro.final.statementA}
                progress={scrollYProgress}
                from={0.72}
                step={0.0022}
                span={0.022}
              />
              <span className="-mt-[0.16em] block">
                <RisingLine
                  text={intro.final.statementB}
                  progress={scrollYProgress}
                  from={0.745}
                  step={0.0022}
                  span={0.022}
                />
              </span>
            </p>
          </motion.div>

          {/* Four acts, four quiet markers. Every act now sits on dark —
              the footage under its veil, then the forest panel — so they
              no longer switch palette partway through. */}
          <div
            className="absolute bottom-8 right-6 z-40 flex items-center gap-2.5 md:right-10"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`block h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
                  i === actIndex ? "bg-on-brand" : "bg-on-brand/30"
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
