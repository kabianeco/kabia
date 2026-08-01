"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * Single-press light/dark switch. Renders a stable placeholder until mounted so
 * the server markup and the first client render agree; the actual surface is
 * already correct by then thanks to the pre-paint init script.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = useHydrated() && resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
      title={isDark ? "Aydınlık tema" : "Karanlık tema"}
      className={`flex h-11 w-11 items-center justify-center text-ink/70 transition-colors duration-300 hover:text-ink ${className}`}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}
