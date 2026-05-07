"use client";
import { motion } from "framer-motion";

export default function PhoneMockup({ src }: { src: string }) {
  return (
    <motion.div
      className="ll-pm-outer"
      animate={{ y: [0, -14, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Ambient glow */}
      <motion.div
        className="ll-pm-glow"
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Body */}
      <div className="ll-pm-body">
        {/* Side buttons */}
        <div className="ll-pm-vol1" />
        <div className="ll-pm-vol2" />
        <div className="ll-pm-power" />

        {/* Dynamic Island */}
        <div className="ll-pm-island">
          <div className="ll-pm-cam" />
        </div>

        {/* Screen */}
        <div className="ll-pm-screen">
          <video autoPlay muted loop playsInline src={src} />
          <div className="ll-pm-gloss" />
        </div>

        {/* Home bar */}
        <div className="ll-pm-home" />
      </div>
    </motion.div>
  );
}
