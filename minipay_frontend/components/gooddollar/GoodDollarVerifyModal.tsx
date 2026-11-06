"use client";

import { useEffect, useState } from "react";
import { X, Shield, ExternalLink } from "lucide-react";
import {
  GOODDOLLAR_VERIFY_EVENT,
  type GoodDollarVerifyDetail,
} from "@/lib/goodDollarVerifyPrompt";
import { useGoodDollarVerify } from "@/hooks/useGoodDollarVerify";

const DEFAULT_MESSAGE =
  "Verify your humanity with GoodDollar to play. It's a quick one-time check and uses your connected wallet.";

export default function GoodDollarVerifyModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<GoodDollarVerifyDetail | null>(null);
  const { startVerification, sdkReady } = useGoodDollarVerify();

  useEffect(() => {
    const onEvent = (e: Event) => {
      const custom = e as CustomEvent<GoodDollarVerifyDetail>;
      setDetail(custom.detail ?? null);
      setOpen(true);
    };
    window.addEventListener(GOODDOLLAR_VERIFY_EVENT, onEvent);
    return () => window.removeEventListener(GOODDOLLAR_VERIFY_EVENT, onEvent);
  }, []);

  if (!open) return null;

  const message = detail?.message || DEFAULT_MESSAGE;

  const handleClose = () => {
    setOpen(false);
  };

  const handleVerify = () => {
    void startVerification();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gooddollar-verify-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-[#003B3E] bg-[#0A1618] shadow-[0_0_60px_rgba(0,240,255,0.12)] overflow-hidden">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 p-2.5">
              <Shield className="w-7 h-7 text-[#00F0FF]" />
            </div>
            <h2
              id="gooddollar-verify-title"
              className="font-orbitron text-xl sm:text-2xl font-bold text-white"
            >
              Verify with GoodDollar
            </h2>
          </div>

          <p className="text-slate-300 text-sm sm:text-base font-dmSans mb-6 leading-relaxed">
            {message}
          </p>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleVerify}
              disabled={!sdkReady}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-[#010F10] font-orbitron font-bold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              title={sdkReady ? undefined : "Connect your MiniPay wallet on Celo"}
            >
              <ExternalLink className="w-5 h-5" />
              {sdkReady ? "Verify with GoodDollar" : "Connect wallet to verify"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 rounded-xl border border-[#003B3E] text-slate-300 font-dmSans text-sm hover:text-[#00F0FF] hover:border-[#00F0FF]/40 transition-colors"
            >
              I&apos;ve verified — close and retry
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500 font-dmSans">
            GoodDollar runs a short face-match. Your Tycoon wallet stays
            connected — you&apos;ll be sent back here when it&apos;s done, then tap
            Play again.
          </p>
        </div>
      </div>
    </div>
  );
}
