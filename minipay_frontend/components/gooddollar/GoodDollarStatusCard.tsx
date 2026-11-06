"use client";

import { ExternalLink, Loader2, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { useGoodDollarStatus } from "@/hooks/useGoodDollarStatus";
import { useGoodDollarVerify } from "@/hooks/useGoodDollarVerify";
import type { WalletChain } from "@/lib/walletSession";

type GoodDollarStatusCardProps = {
  /** `hero` = slim strip for home; `card` = full Profile block (default). */
  variant?: "card" | "hero";
  className?: string;
  /** Pass guest/play address so the hook can send wallet auth params like DailyClaim. */
  playAddress?: string | null;
  chain?: WalletChain;
};

export default function GoodDollarStatusCard({
  variant = "card",
  className = "",
  playAddress,
  chain = "CELO",
}: GoodDollarStatusCardProps) {
  const { data, isLoading, isFetching, isError, isUnauthorized, canCallApi, refetch } =
    useGoodDollarStatus({ chain, playAddress });
  const { startVerification, sdkReady } = useGoodDollarVerify();

  // No wallet + no token → there's nothing to check. Hero: hide entirely so we
  // don't nag unconnected visitors. Card: show a muted sign-in hint.
  if (!canCallApi) {
    if (variant === "hero") return null;
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400 ${className}`}>
        Connect your wallet or sign in to check GoodDollar status.
      </div>
    );
  }

  // Don't flash "Not verified" while the first fetch is in flight.
  if (isLoading || (!data && !isError)) {
    if (variant === "hero") {
      return (
        <div
          className={`w-full max-w-[240px] flex items-center justify-center gap-1.5 py-0.5 ${className}`}
        >
          <Loader2 className="w-3 h-3 text-slate-500 animate-spin shrink-0" />
          <span className="text-[10px] text-slate-500">G$…</span>
        </div>
      );
    }
    return (
      <div className={`rounded-xl border border-[#003B3E]/60 bg-[#0E1415]/50 p-4 flex items-center gap-3 min-h-[80px] ${className}`}>
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-400">Checking GoodDollar verification…</span>
      </div>
    );
  }

  if (isError || !data) {
    const message = isUnauthorized
      ? "Connect your wallet or sign in to check GoodDollar status."
      : "Couldn't load GoodDollar status.";
    return (
      <div
        className={`rounded-xl border border-[#003B3E]/60 bg-[#0E1415]/50 p-3 text-sm text-slate-400 flex items-center justify-between gap-3 ${className}`}
      >
        <span className="text-xs sm:text-sm">{message}</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data.enabled) {
    if (variant === "hero") return null;
    return (
      <div className={`rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400 ${className}`}>
        GoodDollar verification isn&apos;t available on this environment.
      </div>
    );
  }

  if (variant === "hero") {
    if (data.verified) {
      return (
        <div
          className={`w-full max-w-[240px] flex items-center justify-center gap-1.5 px-1 py-0.5 ${className}`}
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400/80 shrink-0" />
          <p className="text-[10px] font-orbitron text-emerald-200/80 truncate">G$ verified</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-0.5 rounded text-slate-500 hover:text-cyan-300 disabled:opacity-50"
            aria-label="Recheck verification"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`w-full max-w-[240px] flex items-center gap-2 rounded-md border border-cyan-500/20 bg-[#0E1415]/40 px-2 py-1 ${className}`}
      >
        <Shield className="w-3 h-3 text-cyan-300/80 shrink-0" />
        <p className="flex-1 min-w-0 text-[10px] text-slate-300 truncate">G$ needed to play</p>
        <button
          type="button"
          onClick={() => {
            void startVerification();
          }}
          disabled={!sdkReady}
          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-orbitron font-semibold uppercase tracking-wide border border-cyan-400/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title={sdkReady ? undefined : "Connect your MiniPay wallet on Celo"}
        >
          Verify
        </button>
      </div>
    );
  }

  if (data.verified) {
    return (
      <div className={`rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 flex items-center gap-3 ${className}`}>
        <div className="rounded-lg bg-emerald-500/20 p-2 border border-emerald-400/30 flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-emerald-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Verified with GoodDollar</p>
          <p className="text-xs text-slate-400 truncate">
            Daily claim includes a G$ citizen TYC bonus
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 disabled:opacity-50"
          aria-label="Recheck verification"
          title="Recheck (cached up to 1 min)"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
    );
  }

  const handleVerify = () => {
    void startVerification();
  };

  return (
    <div className={`rounded-xl border border-cyan-500/20 bg-[#0E1415]/50 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="rounded-lg bg-cyan-500/10 p-2 border border-cyan-400/20 flex-shrink-0">
          <Shield className="w-5 h-5 text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Not verified with GoodDollar</p>
          <p className="text-xs text-slate-400 truncate">
            Verify to play and unlock the daily G$ TYC bonus
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-md text-slate-400 hover:text-cyan-300 disabled:opacity-50"
          aria-label="Recheck verification"
          title="Recheck (cached up to 1 min)"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>
      <button
        type="button"
        onClick={handleVerify}
        disabled={!sdkReady}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-[#010F10] font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title={sdkReady ? undefined : "Connect your MiniPay wallet on Celo"}
      >
        <ExternalLink className="w-4 h-4" />
        {sdkReady ? "Verify with GoodDollar" : "Connect wallet to verify"}
      </button>
      <p className="mt-2 text-[11px] text-slate-500">
        May take up to a minute to update here after you verify.
      </p>
    </div>
  );
}
