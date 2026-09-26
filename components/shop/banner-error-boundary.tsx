"use client";

import { Component, type ReactNode } from "react";

/**
 * S24: the shop banner renders an admin-controlled URL through next/image,
 * which throws for an unlisted host or malformed path and would otherwise
 * take down the entire /shop route. The save-time allowlist plus
 * shopBannerVisible gate should prevent that; this boundary is the last
 * line — a broken banner disappears instead of breaking the page.
 */
export function BannerErrorBoundary({ children }: { children: ReactNode }) {
  return <BannerGuard>{children}</BannerGuard>;
}

type GuardState = { broken: boolean };

class BannerGuard extends Component<{ children: ReactNode }, GuardState> {
  state: GuardState = { broken: false };

  static getDerivedStateFromError(): GuardState {
    return { broken: true };
  }

  render() {
    if (this.state.broken) return null;
    return this.props.children;
  }
}
