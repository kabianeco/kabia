import { resolveDefaultTheme, varsToCss } from "@/lib/theme-engine/resolve";
import type { ResolvedTheme } from "@/lib/theme-engine/resolve";

/**
 * Renders the published theme as an SSR `<style id="kabia-theme-vars">` in the
 * document `<head>`, so the very first paint already carries the operator's
 * chosen preset and fonts. No `useEffect`, no client fetch, no flash.
 *
 * The variables override the `:root` defaults from `globals.css`, which
 * themselves reproduce the balanced + Kabia Original design — so when the
 * published theme equals the default (the seeded row), the override is a
 * no-op visually and the site is byte-for-byte unchanged.
 */
export function ThemeVars({ theme }: { theme: ResolvedTheme }) {
  const css = varsToCss(theme.vars, ":root");
  return (
    <style
      id="kabia-theme-vars"
      // The variables are a controlled set of approved values, never
      // user-supplied CSS, so dangerouslySetInnerHTML is safe here.
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}

/** Fallback vars (balanced + Kabia Original), used if Supabase is unreachable. */
export function ThemeVarsFallback() {
  return <ThemeVars theme={resolveDefaultTheme()} />;
}