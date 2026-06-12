"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useIsRegistered } from "@/context/ContractProvider";
import { Loader2, AlertCircle } from "lucide-react";

/**
 * AI game entry for MiniPay mobile. With a game code, always opens /board-3d-mobile.
 */
export default function AiPlay3DPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [gameCode, setGameCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const { address } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isGuest = !!(guestUser && !address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);

  useEffect(() => {
    const code = searchParams.get("gameCode") || localStorage.getItem("gameCode");
    if (code && code.length === 6) {
      setGameCode(code.trim().toUpperCase());
      localStorage.setItem("gameCode", code.trim().toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    if (gameCode && gameCode.length === 6) {
      router.replace(`/board-3d-mobile?gameCode=${encodeURIComponent(gameCode)}`);
    }
  }, [gameCode, router]);

  const handleGoWithCode = useCallback(() => {
    const trimmed = codeInput.trim().toUpperCase();
    if (trimmed.length === 6) {
      setGameCode(trimmed);
      localStorage.setItem("gameCode", trimmed);
      router.replace(`/ai-play-3d?gameCode=${encodeURIComponent(trimmed)}`);
    }
  }, [codeInput, router]);

  if (!isRegisteredLoading && isUserRegistered === false && !isGuest) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-8 px-8 text-center">
        <AlertCircle className="w-20 h-20 text-red-400" />
        <h2 className="text-3xl font-bold text-white">Registration required</h2>
        <p className="text-gray-300 max-w-md">Register your wallet to play, or continue as guest from the home page.</p>
        <Link href="/" className="px-8 py-4 bg-[#00F0FF] text-[#010F10] font-bold rounded-lg hover:opacity-90">
          Go home
        </Link>
      </div>
    );
  }

  if (gameCode && gameCode.length === 6) {
    return (
      <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-4 text-cyan-300">
        <Loader2 className="w-12 h-12 animate-spin" />
        <p className="text-xl">Opening mobile 3D board…</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#010F10] flex flex-col items-center justify-center gap-6 p-6 text-white">
      <h1 className="text-2xl font-bold text-cyan-400">Play AI in 3D</h1>
      <p className="text-gray-400 text-center max-w-md">
        Create an AI game, then you’ll be sent here. Or enter a game code if you have one.
      </p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Link
          href="/play-ai-3d"
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#00FFAA] to-[#00F0FF] text-black font-semibold text-center hover:opacity-90"
        >
          Create AI game
        </Link>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Game code"
            maxLength={6}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            className="flex-1 px-4 py-3 rounded-lg bg-black/30 border border-cyan-500/50 text-white placeholder-gray-500"
          />
          <button
            onClick={handleGoWithCode}
            disabled={codeInput.trim().length !== 6}
            className="px-4 py-3 rounded-lg bg-cyan-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Go
          </button>
        </div>
      </div>
      <Link href="/" className="text-sm text-gray-500 hover:text-cyan-400 mt-4">
        Back to home
      </Link>
    </div>
  );
}
