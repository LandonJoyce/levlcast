"use client";
import { motion } from "framer-motion";

export default function PhoneMockup({ src }: { src: string }) {
  return (
    <motion.div
      className="ll-pm-outer"
      animate={{ y: [0, -14, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.div
        className="ll-pm-glow"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="ll-pm-device">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/la/phone-frame.png" className="ll-pm-frame" alt="" />
        <video autoPlay muted loop playsInline src={src} className="ll-pm-vid" />
      </div>
    </motion.div>
  );
}
