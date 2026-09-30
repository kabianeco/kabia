/**
 * The light/dark boot script and its storage key, shared by the root layout
 * (server) and the theme provider (client).
 *
 * This module must stay free of "use client". A value exported from a client
 * module reaches a server component as a client reference, not as a string: the
 * layout's <head> script then waits on the layout chunk during hydration. When
 * that chunk lands after hydration has entered <head>, React 19 resumes in
 * <body> with its cursor still inside <head> and throws #418 on the skip link.
 * A plain module is inlined into the RSC payload as text and never suspends.
 */
export const THEME_STORAGE_KEY = "kabia_theme";

/**
 * The top-surface colors the status-bar tint follows, in both modes. Kept
 * next to the boot script so the pre-paint value and the provider effect
 * below can never drift apart from each other — or from --surface.
 */
export const THEME_SURFACE_LIGHT = "#f4f1e8";
export const THEME_SURFACE_DARK = "#12150f";

/**
 * Runs before first paint, ahead of React, so the correct surface is already
 * painted when the page appears — no flash of the wrong theme. Kept in sync
 * with the reader in lib/theme.tsx; both use this key and the same attribute.
 */
export const themeInitScript = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var t=(c==="light"||c==="dark")?c:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(c==="light"||c==="dark"){document.documentElement.setAttribute("data-theme",c)}var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",t==="dark"?"#12150f":"#f4f1e8")}catch(e){}})();`;
