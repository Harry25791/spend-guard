"use client";
import { motion } from "framer-motion";

export default function Stagger({ children }: React.PropsWithChildren) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0, y: 6 },
        show: {
          opacity: 1,
          y: 0,
          transition: { staggerChildren: 0.02, duration: 0.18, ease: "easeOut" },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
