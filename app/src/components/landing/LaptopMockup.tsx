"use client";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export default function LaptopMockup({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });

  return (
    <div ref={ref} className="ll-lm-scene">
      <motion.div
        className="ll-lm-wrap"
        initial={{ rotateX: 28, scale: 0.88, opacity: 0, y: 40 }}
        animate={inView ? { rotateX: 7, scale: 1, opacity: 1, y: 0 } : {}}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="ll-lm-lid">
          <div className="ll-lm-camera" />
          <div className="ll-lm-screen">
            <video autoPlay muted loop playsInline src={src} className="ll-lm-vid" />
          </div>
        </div>
        <div className="ll-lm-hinge" />
        <div className="ll-lm-base">
          <div className="ll-lm-trackpad-slot" />
        </div>
      </motion.div>
    </div>
  );
}
