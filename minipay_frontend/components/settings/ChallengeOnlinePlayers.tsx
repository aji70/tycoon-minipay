"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Loader2, Swords } from "lucide-react";
import { useAccount, useChainId, usePublicClient, useWriteContract, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { isAddress, type Address } from "viem";
import { useOnlineUsers, type OnlineUser } from "@/hooks/useOnlineUsers";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { canAccessChallenges } from "@/lib/featureAccess";
import { presenceStatusLabel } from "@/lib/presenceStatus";
import { apiClient } from "@/lib/api";
import { createSignedChallengeLobby } from "@/lib/createSignedChallengeLobby";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { useGetUsername, useIsRegistered, useApprove, useStakeTokenAddress } from "@/context/ContractProvider";
import Erc20Abi from "@/context/abi/ERC20abi.json";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";

function shortAddress(addr?: string | null): string {
  if (!addr || addr.length < 10) return "Player";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

type ChallengeOnlinePlayersProps = {
  username?: string | null;
  /** Waiting room path after challenge (default MiniPay 3D). */
  redirectToWaiting?: string;
};

/**
 * Join-room section: live online list with one-tap Challenge (Free / Staked).
 */
export default function ChallengeOnlinePlayers({
  username,
  redirectToWaiting = "/game-waiting-3d",
}: ChallengeOnlinePlayersProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const safeAddress = address && isAddress(address) ? address : undefined;
  const { data: onChainUsername } = useGetUsername(safeAddress);
  const { data: isUserRegistered } = useIsRegistered(safeAddress);
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const [challengeBusy, setChallengeBusy] = useState(false);
  const [stakePrompt, setStakePrompt] = useState<{
    opponentUserId: number;
    label: string;
  } | null>(null);
  const [stakeMode, setStakeMode] = useState<"free" | "staked">("free");
  const [stakeAmount, setStakeAmount] = useState(5);

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[
    chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES
  ] as Address | undefined;
  const { stakeTokenAddress } = useStakeTokenAddress();
  const { approve: approveUSDC } = useApprove();
  const { data: stakeAllowance, refetch: refetchAllowance } = useReadContract({
    address: stakeTokenAddress,
    abi: Erc20Abi,
    functionName: "allowance",
    args: safeAddress && contractAddress ? [safeAddress, contractAddress] : undefined,
    query: { enabled: !!safeAddress && !!stakeTokenAddress && !!contractAddress },
  });

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const displayUsername = guestUser?.username ?? username ?? undefined;
  const canAct = isConnected || !!guestUser;
  const canChallenge =
    canAccessChallenges(username) || canAccessChallenges(guestUser?.username);

  const { onlineUsers, onlineCount } = useOnlineUsers(presenceAddress, {
    enabled: canAct,
    userId: guestUser?.id,
    username: displayUsername,
    status: "lobby",
    registerPresence: false,
  });

  const myUsername = (displayUsername ?? "").trim().toLowerCase();
  const myAddress = (presenceAddress ?? "").trim().toLowerCase();
  const myUserId = guestUser?.id ?? null;

  const isSelfUser = (u: OnlineUser) => {
    if (myUserId != null && u.userId != null && Number(u.userId) === Number(myUserId)) return true;
    if (myUsername && u.username?.trim() && u.username.trim().toLowerCase() === myUsername) return true;
    if (myAddress && u.address?.trim() && u.address.trim().toLowerCase() === myAddress) return true;
    return false;
  };

  const others = onlineUsers.filter((u) => !isSelfUser(u));

  const openStakePrompt = (opponent: OnlineUser) => {
    const opponentUserId = opponent.userId != null ? Number(opponent.userId) : null;
    if (!opponentUserId) {
      toast.error("That player can't be challenged yet");
      return;
    }
    if (opponent.status === "game") {
      toast.error("That player is on the board and can't receive challenges");
      return;
    }
    if (!safeAddress) {
      toast.error("Connect your wallet to challenge — you'll sign create game");
      return;
    }
    setStakeMode("free");
    setStakeAmount(5);
    setStakePrompt({
      opponentUserId,
      label: opponent.username?.trim() || shortAddress(opponent.address),
    });
  };

  const sendChallenge = async (opponentUserId?: number | null, stake = 0) => {
    if (!opponentUserId || challengeBusy) return;
    if (!safeAddress) {
      toast.error("Connect your wallet to challenge — you'll sign create game");
      return;
    }
    if (!isUserRegistered) {
      toast.error("Register on-chain on the home page before challenging");
      return;
    }
    const creatorUsername =
      (typeof onChainUsername === "string" && onChainUsername.trim()) ||
      guestUser?.username?.trim() ||
      username?.trim() ||
      "";
    if (!creatorUsername) {
      toast.error("Set a username before challenging");
      return;
    }
    if (!publicClient) {
      toast.error("Network unavailable");
      return;
    }

    setChallengeBusy(true);
    setStakePrompt(null);
    const toastId = toast.loading(
      stake > 0 ? `Sign staked challenge (${stake} USDT)…` : "Sign create game in your wallet…"
    );
    try {
      const { code, contractGameId } = await createSignedChallengeLobby({
        address: safeAddress,
        username: creatorUsername,
        chainId,
        publicClient,
        writeContractAsync: writeContractAsync as never,
        isMinipay: true,
        stake,
        stakeTokenAddress: stakeTokenAddress ?? null,
        approveUsdc: async (token, spender, amount) => {
          toast.update(toastId, { render: "Approve USDT…", isLoading: true });
          await approveUSDC(token, spender, amount);
        },
        readAllowance: async () => {
          const r = await refetchAllowance();
          if (r.data != null) return BigInt(r.data.toString());
          if (stakeAllowance != null) return BigInt(stakeAllowance.toString());
          return 0n;
        },
      });

      toast.update(toastId, { render: "Sending challenge…", type: "default", isLoading: true });
      const res = await apiClient.post(
        "/challenges",
        {
          opponentId: opponentUserId,
          gameCode: code,
          contractGameId,
          stake,
          is_minipay: true,
          chain: "CELO",
          address: safeAddress,
        },
        { timeout: 60000 }
      );
      const body = res?.data as {
        data?: { game?: { code?: string }; challenge?: { gameCode?: string } };
        message?: string;
        success?: boolean;
      };
      if (body && body.success === false) {
        throw new Error(body.message || "Challenge failed");
      }
      const gameCode =
        body?.data?.game?.code || body?.data?.challenge?.gameCode || code;
      toast.update(toastId, {
        render: "Challenge sent — waiting in lobby",
        type: "success",
        isLoading: false,
        autoClose: 2500,
      });
      if (gameCode) {
        router.push(`${redirectToWaiting}?gameCode=${encodeURIComponent(gameCode)}`);
      }
    } catch (err: unknown) {
      const msg =
        getContractErrorMessage(err, "") ||
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
        (err as Error)?.message ||
        "Challenge failed";
      toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
    } finally {
      setChallengeBusy(false);
    }
  };

  if (!canAct || !canChallenge) return null;

  const stakeModal =
    typeof document !== "undefined" &&
    stakePrompt &&
    createPortal(
      <div
        className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 p-3 sm:items-center"
        onClick={() => {
          if (!challengeBusy) setStakePrompt(null);
        }}
      >
        <div
          className="w-full max-w-sm rounded-2xl border border-rose-400/30 bg-[#0c1520] p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-orbitron text-sm font-bold uppercase tracking-wider text-rose-200">
            Challenge {stakePrompt.label}
          </p>
          <p className="mt-1 font-dmSans text-xs text-[#8aa4b0]">
            Free games need no stake. Staked games lock USDT for both players.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={challengeBusy}
              onClick={() => void sendChallenge(stakePrompt.opponentUserId, 0)}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 font-orbitron text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10 disabled:opacity-50"
            >
              Free
            </button>
            <button
              type="button"
              disabled={challengeBusy}
              onClick={() => setStakeMode("staked")}
              className={`rounded-xl border px-3 py-3 font-orbitron text-xs font-bold uppercase tracking-wider disabled:opacity-50 ${
                stakeMode === "staked"
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Staked
            </button>
          </div>
          {stakeMode === "staked" ? (
            <div className="mt-3 space-y-2">
              <label className="block font-dmSans text-[11px] text-[#8aa4b0]">
                Stake amount (USDT)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-amber-400/30 bg-black/40 px-3 py-2 font-orbitron text-sm text-amber-100"
                />
              </label>
              <button
                type="button"
                disabled={challengeBusy}
                onClick={() => {
                  if (!Number.isFinite(stakeAmount) || stakeAmount < 1) {
                    toast.error("Enter a valid stake amount");
                    return;
                  }
                  void sendChallenge(stakePrompt.opponentUserId, stakeAmount);
                }}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-400/45 bg-amber-500/20 font-orbitron text-xs font-bold uppercase tracking-wider text-amber-100 disabled:opacity-50"
              >
                {challengeBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `Send ${stakeAmount} USDT challenge`
                )}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={challengeBusy}
            onClick={() => {
              setStakePrompt(null);
              setStakeMode("free");
            }}
            className="mt-3 w-full rounded-lg px-3 py-2 font-dmSans text-xs text-[#8aa4b0] hover:bg-white/5 hover:text-white/80"
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-cyan-400/70 font-orbitron text-xs uppercase tracking-widest">
            Challenge Online Players
          </p>
          <span className="inline-flex items-center gap-1.5 font-dmSans text-[11px] text-[#8aa4b0]">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            />
            <span className="font-orbitron font-bold text-emerald-300">{onlineCount}</span>
            online
          </span>
        </div>

        <div className="rounded-xl border border-rose-400/25 bg-black/60 p-3">
          <p className="mb-3 font-dmSans text-[11px] text-[#8aa4b0]">
            Tap Challenge to invite someone in lobby or a war room. Players already on the board can&apos;t be
            challenged.
          </p>

          {others.length === 0 ? (
            <div className="rounded-lg border border-dashed border-cyan-500/25 bg-cyan-950/10 px-3 py-6 text-center">
              <Swords className="mx-auto mb-2 h-5 w-5 text-rose-300/50" />
              <p className="font-dmSans text-sm text-[#8aa4b0]">
                No players online yet — wait a moment or host a match.
              </p>
            </div>
          ) : (
            <ul className="max-h-[40vh] space-y-2 overflow-y-auto">
              {others.map((u, idx) => {
                const label = u.username?.trim() || shortAddress(u.address) || `Player ${idx + 1}`;
                const inGame = u.status === "game";
                const canChallengeRow = !!(u.userId && !inGame);
                return (
                  <li
                    key={u.userId ?? u.address ?? `online-${idx}`}
                    className="flex min-h-14 items-center gap-2 rounded-xl border border-cyan-500/20 bg-[#0A1A1B]/80 px-2.5 py-2"
                  >
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-rose-400/35 bg-[#0a1a26] font-orbitron text-sm font-bold text-rose-200">
                      {(label[0] || "?").toUpperCase()}
                      <motion.span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-[#071018] bg-emerald-400"
                        animate={{ opacity: [1, 0.45, 1] }}
                        transition={{ repeat: Infinity, duration: 1.4 }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-dmSans text-sm font-semibold text-[#e8f4f7]">{label}</p>
                      <p
                        className={`font-dmSans text-[11px] ${
                          inGame
                            ? "text-amber-300"
                            : u.status === "waiting"
                              ? "text-cyan-300"
                              : "text-[#8aa4b0]"
                        }`}
                      >
                        {presenceStatusLabel(u.status, u.gameCode)}
                      </p>
                    </div>
                    {canChallengeRow ? (
                      <button
                        type="button"
                        disabled={challengeBusy}
                        onClick={() => openStakePrompt(u)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-400/45 bg-rose-500/15 px-2.5 py-2 font-orbitron text-[10px] font-bold uppercase tracking-wider text-rose-100 transition hover:bg-rose-500/25 disabled:opacity-50"
                      >
                        {challengeBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Swords className="h-3.5 w-3.5" />
                        )}
                        Challenge
                      </button>
                    ) : (
                      <span className="shrink-0 px-1 font-dmSans text-[10px] text-amber-200/80">
                        {inGame ? "In game" : "Unavailable"}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {stakeModal}
    </>
  );
}
