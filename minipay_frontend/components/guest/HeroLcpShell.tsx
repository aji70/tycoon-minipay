import { NeonTitle } from "@/components/hero/NeonTitle";

/**
 * Server-rendered hero shell — paints TYCOON in the first HTML response (mobile LCP).
 * Title sits in the middle band; welcome + CTAs overlay above/below via HomeHeroClient.
 */
export default function HeroLcpShell() {
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-[#010F10]/95 px-4">
      {/* Top band: reserved for welcome / level (overlay) */}
      <div className="h-[calc(var(--mobile-nav-offset)+4.5rem)] shrink-0" aria-hidden />
      {/* Middle band: LCP title */}
      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <p className="mb-2 text-center font-orbitron text-sm font-bold text-[#F0F7F7]/90">
          Conquer • Build • Trade On-chain
        </p>
        <NeonTitle text="TYCOON" size="mobile" subtle />
      </div>
      {/* Bottom band: reserved for action buttons + stats (overlay) */}
      <div className="h-[14.5rem] shrink-0" aria-hidden />
    </div>
  );
}
