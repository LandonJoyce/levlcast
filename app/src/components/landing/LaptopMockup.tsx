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
        {/* Lid */}
        <div className="ll-lm-lid">
          <div className="ll-lm-cam" />
          <div className="ll-lm-bezel">
            {/* Browser chrome */}
            <div className="ll-lm-chrome">
              <div className="ll-lm-dots">
                <span style={{ background: "#FF5F57" }} />
                <span style={{ background: "#FFBD2E" }} />
                <span style={{ background: "#28C840" }} />
              </div>
              <div className="ll-lm-url">levlcast.com/dashboard</div>
            </div>
            <div className="ll-lm-video">
              <video autoPlay muted loop playsInline src={src} />
              <div className="ll-lm-vignette" />
              <div className="ll-lm-scanlines" />
            </div>
          </div>
          <div className="ll-lm-lid-gloss" />
        </div>

        {/* Hinge */}
        <div className="ll-lm-hinge" />

        {/* Base */}
        <div className="ll-lm-base">
          <div className="ll-lm-keys" />
          <div className="ll-lm-pad" />
        </div>
      </motion.div>

      {/* Floor glow */}
      <motion.div
        className="ll-lm-floor"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 1.8, delay: 0.4 }}
      />
    </div>
  );
}
