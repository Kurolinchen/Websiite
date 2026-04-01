"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

export function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  digits = 0,
  className,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  digits?: number;
  className?: string;
}) {
  const motionValue = useMotionValue(value);
  const display = useTransform(
    motionValue,
    (latest) => `${prefix}${latest.toFixed(digits)}${suffix}`
  );

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    });

    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span className={className}>{display}</motion.span>;
}
