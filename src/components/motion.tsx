"use client";

import { animate, motion, MotionConfig, useInView, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { compactMoney, money } from "@/lib/format";

const ease = [0.22, 1, 0.36, 1] as const;

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/* Fade-and-rise when scrolled into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

/* A list whose children arrive one after another. Use <StaggerItem> for children. */
export function Stagger({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const Comp = as === "ul" ? motion.ul : as === "ol" ? motion.ol : motion.div;
  return (
    <Comp variants={list} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} className={className}>
      {children}
    </Comp>
  );
}

export function StaggerItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp variants={item} className={className}>
      {children}
    </Comp>
  );
}

/* Counts up from zero the first time it scrolls into view. */
export function CountUp({
  value,
  format = "number",
  duration = 1.6,
  className,
}: {
  value: number;
  format?: "number" | "money" | "compact";
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = animate(0, value, { duration: still ? 0 : duration, ease, onUpdate: (v) => setN(v) });
    return () => controls.stop();
  }, [inView, value, duration]);

  const shown = Math.round(n);
  const text = format === "money" ? money(shown) : format === "compact" ? compactMoney(shown) : shown.toLocaleString("en-NG");
  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}

/* Headline whose lines rise in, one after another, on page load. */
export function HeroLines({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <h1 className={className}>
      {lines.map((line, i) => (
        <span key={line} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            initial={{ y: "105%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.1 + i * 0.12, ease }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export function FadeIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* Small celebratory burst. Mount it with a changing key to replay. */
export function Burst({ className }: { className?: string }) {
  const colors = ["#9b8cff", "#ff8fb1", "#ffc79a", "#52e3b6", "#7cc8ff"];
  return (
    <span className={`pointer-events-none absolute inset-0 ${className ?? ""}`} aria-hidden>
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        const dist = 38 + (i % 3) * 14;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 size-1.5 rounded-full"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        );
      })}
    </span>
  );
}
