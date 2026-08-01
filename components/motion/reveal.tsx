"use client";

import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to delay the entrance; use sparingly for stagger. */
  delay?: number;
  as?: "div" | "p" | "figure" | "li" | "h2" | "h3";
}

/**
 * The page's only entrance animation: a slow rise-and-fade on first view.
 * Under prefers-reduced-motion the rise is dropped and only opacity remains.
 */
export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const reduced = useReducedMotion();
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: DURATION.base, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}
