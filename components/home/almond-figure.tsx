/**
 * Static almond illustration: the graceful fallback for the 3D scene.
 * Shown while the WebGL bundle loads, on small screens, when WebGL is
 * unavailable and when the visitor prefers reduced motion.
 */
export function AlmondFigure({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 420 500"
      role="presentation"
      aria-hidden="true"
      className={className}
    >
      {/* Ground shadow */}
      <ellipse cx="210" cy="452" rx="120" ry="16" fill="#1c201b" opacity="0.07" />
      <g transform="rotate(-14 210 250)">
        {/* Shell half, behind */}
        <path
          d="M231 52 C317 130 348 240 310 338 C286 402 186 406 158 344 C118 246 148 132 231 52 Z"
          fill="#c29a63"
          stroke="#1c201b"
          strokeOpacity="0.18"
          strokeWidth="1.5"
        />
        {/* Shell pit texture */}
        <g fill="#1c201b" opacity="0.1">
          <circle cx="240" cy="150" r="2.4" />
          <circle cx="272" cy="196" r="2.2" />
          <circle cx="228" cy="238" r="2.6" />
          <circle cx="286" cy="262" r="2.2" />
          <circle cx="250" cy="308" r="2.4" />
          <circle cx="206" cy="188" r="2.2" />
          <circle cx="204" cy="292" r="2.2" />
          <circle cx="264" cy="336" r="2" />
        </g>
        {/* Kernel, revealed in front */}
        <path
          d="M156 156 C210 208 228 280 202 342 C186 382 122 384 104 344 C78 282 100 210 156 156 Z"
          fill="#e0c391"
          stroke="#1c201b"
          strokeOpacity="0.16"
          strokeWidth="1.5"
        />
        <path
          d="M152 190 C186 232 196 284 182 326"
          fill="none"
          stroke="#1c201b"
          strokeOpacity="0.12"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
