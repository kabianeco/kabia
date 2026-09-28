import { Star } from "lucide-react";

/** Five-star rating row, filled to the rounded value. */
export function Stars({ value, className = "h-4 w-4" }: { value: number; className?: string }) {
  return (
    <span className="flex" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`${className} ${
            i < Math.round(value)
              ? "fill-brand text-brand"
              : "fill-transparent text-ink/25"
          }`}
        />
      ))}
    </span>
  );
}

/** Initials stand in for reviewer avatars — no third-party image host. */
export function Monogram({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink/15 font-serif text-sm text-olive"
    >
      {initials || "K"}
    </span>
  );
}
