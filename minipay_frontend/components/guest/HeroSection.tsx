"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { motion } from "framer-motion";
import HeroMarketingContent from "@/components/guest/HeroMarketingContent";
import HeroNoticeBanner from "@/components/guest/HeroNoticeBanner";

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
});

const HeroSection: React.FC = () => {
  const [walletLoaded, setWalletLoaded] = useState(false);
  const [walletVisible, setWalletVisible] = useState(false);
  const [hideDescription, setHideDescription] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const revealWallet = () => {
      if (cancelled) return;
      void import("@/components/guest/HeroWalletPanel").then(() => {
        if (cancelled) return;
        setWalletLoaded(true);
        requestAnimationFrame(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (!cancelled) setWalletVisible(true);
          });
        });
      });
    };

    const onIntent = () => revealWallet();
    window.addEventListener("pointerdown", onIntent, { once: true, passive: true });
    window.addEventListener("keydown", onIntent, { once: true });

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(revealWallet, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.removeEventListener("pointerdown", onIntent);
        window.removeEventListener("keydown", onIntent);
        cancelIdleCallback(id);
      };
    }

    const t = window.setTimeout(revealWallet, 800);
    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onIntent);
      window.removeEventListener("keydown", onIntent);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    setIsMobileViewport(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    if (isMobileViewport) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!parallaxRef.current) return;
      const rect = parallaxRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isMobileViewport]);

  return (
    <section
      ref={parallaxRef}
      className="z-0 w-full min-h-below-mobile-nav relative bg-[#010F10]"
    >
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="w-full h-full overflow-hidden absolute inset-0"
          initial={false}
          animate={{
            x: isMobileViewport ? 0 : mousePosition.x * 10,
            y: isMobileViewport ? 0 : mousePosition.y * 10,
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

        <div className="hero-overlay-fade-in absolute inset-0">
          <ParticleBackground />
          <ScanlineOverlay />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#010F10]/20 to-[#010F10]/60 z-5" />
      </div>

      <main className="relative z-20 flex h-full w-full flex-col items-center justify-start gap-1 overflow-y-auto overflow-x-hidden px-4 pt-4 pb-24">
        <HeroMarketingContent showDescription={!hideDescription} />

        <div className="relative z-1 mt-6 flex min-h-[152px] w-full flex-col items-center justify-center gap-4">
          <div
            className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 transition-opacity duration-500 ease-out ${
              walletVisible ? "opacity-0" : "opacity-100"
            }`}
            aria-hidden={walletVisible}
          >
            <div className="h-[52px] w-[220px] rounded-xl border border-[#00F0FF]/12 bg-[#011112]/50" />
            <div className="h-3 w-36 rounded-full bg-[#00F0FF]/8" />
          </div>

          {walletLoaded && (
            <div
              className={`relative w-full transition-opacity duration-500 ease-out ${
                walletVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <HeroWalletPanel onReturningPlayerChange={setHideDescription} />
            </div>
          )}
        </div>
      </main>

      <div className="hero-overlay-fade-in">
        <WorldStatsBar playersOnline={1234} propertiesOwned={5678} tokensInPlay="12.5M" />
      </div>

      <HeroNoticeBanner />
    </section>
  );
};

export default HeroSection;
