// components/HomeClient.tsx
"use client";

import dynamic from "next/dynamic";
import WhatIsTycoon from "@/components/guest/WhatIsTycoon";
import JoinOurCommunity from "@/components/guest/JoinOurCommunity";
import Footer from "@/components/shared/Footer";

/** Hero pulls wagmi + Privy + contracts — own chunk so the home entry bundle parses less upfront. */
const HeroSection = dynamic(() => import("@/components/guest/HeroSection"), {
  loading: () => (
    <div
      className="min-h-[100dvh] w-full bg-[#010F10]"
      aria-busy="true"
      aria-label="Loading"
    />
  ),
});

const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"), {
  loading: () => (
    <div className="min-h-[856px] w-full bg-[#010F10]" aria-hidden />
  ),
});

export default function HomeClient() {
  return (
    <main className="w-full">
      <HeroSection />
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
      <Footer />
    </main>
  );
}