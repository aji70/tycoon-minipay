"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { motion } from "framer-motion";
import HeroMarketingContent from "@/components/guest/HeroMarketingContent";

const ParticleBackground = dynamic(
  () => import("@/components/hero/ParticleBackground").then((m) => ({ default: m.ParticleBackground })),
  { ssr: false }
);
const ScanlineOverlay = dynamic(
  () => import("@/components/hero/ScanlineOverlay").then((m) => ({ default: m.ScanlineOverlay })),
  { ssr: false }
);
const WorldStatsBar = dynamic(
  () => import("@/components/hero/WorldStatsBar").then((m) => ({ default: m.WorldStatsBar })),
  { ssr: false }
);
const HeroWalletPanel = dynamic(() => import("@/components/guest/HeroWalletPanel"), {
  ssr: false,
  loading: () => null,
});

const HeroSection: React.FC = () => {
  const [walletReady, setWalletReady] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const run = () => setWalletReady(true);
    const onIntent = () => setWalletReady(true);
    window.addEventListener("pointerdown", onIntent, { once: true, passive: true });
    window.addEventListener("keydown", onIntent, { once: true });
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2000 });
      return () => {
        window.removeEventListener("pointerdown", onIntent);
        window.removeEventListener("keydown", onIntent);
        cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(run, 1200);
    return () => {
      window.removeEventListener("pointerdown", onIntent);
      window.removeEventListener("keydown", onIntent);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!parallaxRef.current) return;
      const rect = parallaxRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section
      ref={parallaxRef}
      className="z-0 w-full min-h-below-mobile-nav relative bg-[#010F10]"
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="w-full h-full overflow-hidden absolute inset-0"
          animate={{
            x: window.innerWidth < 768 ? 0 : mousePosition.x * 10,
            y: window.innerWidth < 768 ? 0 : mousePosition.y * 10,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <Image
            src={herobg}
            alt="Hero Background"
            className="w-full h-full object-cover"
            width={1440}
            height={1024}
            priority
            fetchPriority="high"
            sizes="(max-width: 768px) 100vw, 1440px"
            quality={75}
          />
        </motion.div>

        <ParticleBackground />
        <ScanlineOverlay />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#010F10]/20 to-[#010F10]/60 z-5" />
      </div>

      <main className="relative z-20 flex h-full w-full flex-col items-center justify-start gap-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-24">
        {walletReady ? (
          <HeroWalletPanel />
        ) : (
          <HeroMarketingContent />
        )}
      </main>

      <WorldStatsBar playersOnline={1234} propertiesOwned={5678} tokensInPlay="12.5M" />
    </section>
  );
};

export default HeroSection;
