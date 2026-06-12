"use client";

import { motion } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { NeonTitle } from "@/components/hero/NeonTitle";

/** Hero copy shown before wallet/contract chunk loads — no wagmi or ContractProvider. */
export default function HeroMarketingContent({
  showDescription = true,
  showActionPlaceholder = true,
}: {
  showDescription?: boolean;
  showActionPlaceholder?: boolean;
}) {
  return (
    <>
      <motion.div
        className="mt-4 flex w-full max-w-sm justify-center px-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <TypeAnimation
          sequence={[
            "Conquer",
            1200,
            "Conquer • Build",
            1200,
            "Conquer • Build • Trade",
            1800,
            "Play Solo vs AI",
            2000,
            "Conquer • Build",
            1000,
            "Conquer",
            1000,
            "",
            500,
          ]}
          wrapper="span"
          speed={40}
          repeat={Infinity}
          className="font-orbitron text-[18px] font-[700] text-[#F0F7F7] text-center block leading-snug"
          style={{
            textShadow: "0 0 8px rgba(0, 240, 255, 0.6), 0 0 16px rgba(0, 240, 255, 0.3)",
          }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <NeonTitle text="TYCOON" size="lg" />
      </motion.div>

      <motion.div
        className="w-full max-w-sm px-2 text-center text-[#F0F7F7] -tracking-[2%]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <TypeAnimation
          sequence={[
            "Roll the dice",
            2000,
            "Buy properties",
            2000,
            "Collect rent",
            2000,
            "Play against AI opponents",
            2200,
            "Become the top tycoon",
            2000,
          ]}
          wrapper="span"
          speed={50}
          repeat={Infinity}
          className="font-orbitron text-[16px] font-[700] text-[#F0F7F7] text-center block leading-snug"
          style={{
            textShadow: "0 0 6px rgba(0, 240, 255, 0.5), 0 0 12px rgba(0, 240, 255, 0.2)",
          }}
        />
        {showDescription && (
          <p className="font-dmSans font-[400] text-[13px] text-[#F0F7F7] mt-3 leading-relaxed text-pretty">
            Step into Tycoon — the Web3 twist on the classic game of strategy,
            ownership, and fortune. Play solo against AI, compete in multiplayer
            rooms, collect tokens, complete quests, and become the ultimate
            blockchain tycoon.
          </p>
        )}
      </motion.div>

      {showActionPlaceholder && (
        <div className="z-1 mt-6 flex min-h-[152px] w-full flex-col items-center justify-center gap-4" aria-busy="true" aria-label="Loading actions" />
      )}
    </>
  );
}
