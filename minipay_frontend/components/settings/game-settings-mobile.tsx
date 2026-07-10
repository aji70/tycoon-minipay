"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronDown,
  Gavel,
  Info,
  Landmark,
  LifeBuoy,
  Lock,
  LockOpen,
  Users,
  X,
} from "lucide-react";
import { GiPrisoner } from "react-icons/gi";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { resolveChainForBackend } from "@/lib/utils/chain";
import { toast } from "react-toastify";
import { generateGameCode } from "@/lib/utils/games";
import { GamePieces } from "@/lib/constants/games";
import { apiClient } from "@/lib/api";
import Erc20Abi from "@/context/abi/ERC20abi.json";
import {
  useIsRegistered,
  useGetUsername,
  useCreateGame,
  useApprove,
  useStakeTokenAddress,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { TYCOON_CONTRACT_ADDRESSES, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { shouldUseBackendGuestGameFlow, ensureMiniPayWalletReady } from "@/lib/minipayGuestFlow";
import { Address, parseUnits } from "viem";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { usePreventDoubleSubmit } from "@/hooks/usePreventDoubleSubmit";
import WhoIsOnlineControl from "@/components/shared/WhoIsOnlineControl";
import { canAccessMultiplayerPreview } from "@/lib/featureAccess";

interface GameCreateResponse {
  data?: {
    data?: { id: string | number };
    id?: string | number;
  };
  id?: string | number;
}

type SettingsState = {
  symbol: string;
  maxPlayers: number;
  privateRoom: boolean;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  startingCash: number;
  stake: number;
  duration: number;
};

const USDC_DECIMALS = 6;
const stakePresets = [1, 5, 10, 25, 50, 100];
const SUPPORT_URL = "https://t.me/+xJLEjw9tbyQwMGVk";

const PIECE_EMOJI: Record<string, string> = {
  hat: "🎩",
  car: "🚗",
  dog: "🐕",
  thimble: "🔧",
  wheelbarrow: "🛒",
  battleship: "🚢",
  boot: "👢",
  iron: "♨️",
  top_hat: "🎩",
};

const DEFAULT_SETTINGS: SettingsState = {
  symbol: "hat",
  maxPlayers: 4,
  privateRoom: false,
  auction: true,
  rentInPrison: true,
  mortgage: true,
  evenBuild: true,
  startingCash: 1500,
  stake: 5,
  duration: 30,
};

const HOUSE_RULES = [
  {
    key: "auction" as const,
    label: "Auction unsold",
    hint: "If a player declines to buy, the property goes to auction among everyone else.",
    Icon: Gavel,
  },
  {
    key: "rentInPrison" as const,
    label: "Rent in jail",
    hint: "Players still collect rent from their properties while in jail.",
    Icon: GiPrisoner,
  },
  {
    key: "mortgage" as const,
    label: "Allow mortgages",
    hint: "Owners can mortgage properties for cash and unmortgage later with interest.",
    Icon: Landmark,
  },
  {
    key: "evenBuild" as const,
    label: "Even building",
    hint: "Houses must be built evenly across a color set — no stacking one tile first.",
    Icon: Building2,
  },
];

function CornerBrackets({ active }: { active?: boolean }) {
  const c = active ? "border-[#00D4FF]" : "border-[#00D4FF]/25";
  return (
    <>
      <span className={`pointer-events-none absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 ${c}`} />
      <span className={`pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 border-r-2 border-t-2 ${c}`} />
      <span className={`pointer-events-none absolute bottom-0 left-0 h-2.5 w-2.5 border-b-2 border-l-2 ${c}`} />
      <span className={`pointer-events-none absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 ${c}`} />
    </>
  );
}

function HudPanel({
  children,
  className = "",
  active = false,
}: {
  children: React.ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-[linear-gradient(160deg,rgba(8,24,40,0.95),rgba(4,12,22,0.92))] ${
        active
          ? "border-[#00D4FF]/55 shadow-[0_0_24px_rgba(0,212,255,0.18)]"
          : "border-[#00D4FF]/18"
      } ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.35) 3px)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.12),transparent_55%)]" />
      <CornerBrackets active={active} />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 font-orbitron text-[11px] font-bold uppercase tracking-[0.18em] text-[#00D4FF]/75">
      {children}
    </p>
  );
}

function pickRandomPiece(): string {
  const pool = GamePieces.slice(0, 4);
  return pool[Math.floor(Math.random() * pool.length)]?.id ?? "hat";
}

interface GameSettingsMobileProps {
  redirectToWaitingRoom?: string;
}

export default function CreateGameMobile({
  redirectToWaitingRoom = "/game-waiting-3d",
}: GameSettingsMobileProps = {}) {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isGuest = shouldUseBackendGuestGameFlow(guestUser, address, wagmiChainId);

  const { data: username } = useGetUsername(address);
  const headerUsername = guestUser?.username ?? (typeof username === "string" ? username : null);
  const showOnlineInHeader = canAccessMultiplayerPreview(headerUsername);
  const { data: isUserRegistered } = useIsRegistered(address);

  const isMiniPay = MINIPAY_CHAIN_IDS.includes(wagmiChainId);
  const chainName = resolveChainForBackend(wagmiChainId);

  const [isFreeGame, setIsFreeGame] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [houseRulesOpen, setHouseRulesOpen] = useState(false);
  const [hintKey, setHintKey] = useState<string | null>(null);
  const [customStake, setCustomStake] = useState("");
  const [gameCode, setGameCode] = useState(() => generateGameCode());
  /** Set after Quick Start state flush so on-chain create uses the new hook args. */
  const [pendingLaunch, setPendingLaunch] = useState<{ free: boolean } | null>(null);

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);

  const contractAddress = TYCOON_CONTRACT_ADDRESSES[
    wagmiChainId as keyof typeof TYCOON_CONTRACT_ADDRESSES
  ] as Address | undefined;
  const { stakeTokenAddress, isLoading: stakeTokenLoading } = useStakeTokenAddress();

  const { data: stakeAllowance, refetch: refetchAllowance } = useReadContract({
    address: stakeTokenAddress,
    abi: Erc20Abi,
    functionName: "allowance",
    args: address && contractAddress ? [address, contractAddress] : undefined,
    query: { enabled: !!address && !!stakeTokenAddress && !!contractAddress && !isFreeGame },
  });

  const gameType = settings.privateRoom ? "PRIVATE" : "PUBLIC";
  const finalStake = isFreeGame || isGuest ? 0 : settings.stake;
  const stakeAmount = parseUnits(finalStake.toString(), USDC_DECIMALS);

  const {
    approve: approveUSDC,
    isPending: approvePending,
    isConfirming: approveConfirming,
  } = useApprove();

  const { write: createGame, isPending: isCreatePending } = useCreateGame(
    username || "",
    gameType,
    settings.symbol,
    settings.maxPlayers,
    gameCode,
    BigInt(settings.startingCash),
    stakeAmount
  );

  const playGuard = usePreventDoubleSubmit();

  const extractGameId = (response: unknown): string | number | undefined => {
    if (typeof response === "string" || typeof response === "number") return response;
    const r = response as GameCreateResponse & {
      gameId?: string | number;
      data?: { game?: { id?: string | number } };
    };
    return (
      r?.data?.data?.id ?? r?.data?.id ?? r?.id ?? r?.gameId ?? r?.data?.game?.id
    );
  };

  const createMatch = useCallback(
    async (opts: {
      settings: SettingsState;
      free: boolean;
      code: string;
    }) => {
      if (isStarting) return;
      setIsStarting(true);
      const toastId = toast.loading("Creating game...");
      const { settings: s, free, code } = opts;
      const mode = s.privateRoom ? "PRIVATE" : "PUBLIC";
      const stake = free || isGuest ? 0 : s.stake;
      const stakeWei = parseUnits(stake.toString(), USDC_DECIMALS);

      try {
        await ensureMiniPayWalletReady();
      } catch (err: unknown) {
        const msg = (err as Error)?.message ?? "Connect your wallet in MiniPay, then try again.";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
        setIsStarting(false);
        return;
      }

      if (isGuest) {
        try {
          toast.update(toastId, { render: "Creating game (guest)..." });
          const res = await apiClient.post<GameCreateResponse>("/games/create-as-guest", {
            code,
            mode,
            symbol: s.symbol,
            number_of_players: s.maxPlayers,
            stake: 0,
            starting_cash: s.startingCash,
            is_ai: false,
            is_minipay: isMiniPay,
            chain: chainName,
            duration: s.duration,
            use_usdc: false,
            settings: {
              auction: s.auction,
              rent_in_prison: s.rentInPrison,
              mortgage: s.mortgage,
              even_build: s.evenBuild,
              starting_cash: s.startingCash,
            },
          });
          const dbGameId = extractGameId(res);
          if (!dbGameId) throw new Error("Backend did not return game ID");
          toast.update(toastId, {
            render: `Game created! Code: ${code}`,
            type: "success",
            isLoading: false,
            autoClose: 5000,
            onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${code}`),
          });
        } catch (err: unknown) {
          const msg =
            (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data
              ?.message ??
            (err as Error)?.message ??
            "Failed to create game.";
          toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
        }
        setIsStarting(false);
        return;
      }

      if (!address || !username || !isUserRegistered) {
        toast.update(toastId, {
          render:
            "Connect your wallet and complete on-chain registration on the home page, then try again.",
          type: "error",
          isLoading: false,
          autoClose: 8000,
        });
        setIsStarting(false);
        return;
      }

      if (!contractAddress) {
        toast.update(toastId, {
          render: "Game contract not available on this network.",
          type: "error",
          isLoading: false,
        });
        setIsStarting(false);
        return;
      }

      if (!free && (stakeTokenLoading || !stakeTokenAddress)) {
        toast.update(toastId, {
          render: "USDT not supported on current network.",
          type: "error",
          isLoading: false,
        });
        setIsStarting(false);
        return;
      }

      try {
        if (!free) {
          toast.update(toastId, { render: "Checking USDT allowance..." });
          const allowanceResult = await refetchAllowance();
          const allowance = allowanceResult.data
            ? BigInt(allowanceResult.data.toString())
            : stakeAllowance
              ? BigInt(stakeAllowance.toString())
              : 0n;
          if (allowance < stakeWei) {
            toast.update(toastId, { render: "Approving USDT (one-time)..." });
            await approveUSDC(stakeTokenAddress!, contractAddress, stakeWei);
            await new Promise((r) => setTimeout(r, 4000));
            await refetchAllowance();
          }
        }

        toast.update(toastId, { render: "Creating game on-chain (sign in wallet)..." });
        const onChainGameId = await createGame();
        if (onChainGameId == null) throw new Error("Failed to create game on-chain");

        toast.update(toastId, { render: "Saving game to server..." });
        const saveRes = await apiClient.post<GameCreateResponse>("/games", {
          id: onChainGameId.toString(),
          code,
          mode,
          address,
          symbol: s.symbol,
          number_of_players: s.maxPlayers,
          stake,
          starting_cash: s.startingCash,
          is_ai: false,
          is_minipay: isMiniPay,
          chain: chainName,
          duration: s.duration,
          use_usdc: !free,
          settings: {
            auction: s.auction,
            rent_in_prison: s.rentInPrison,
            mortgage: s.mortgage,
            even_build: s.evenBuild,
            starting_cash: s.startingCash,
          },
        });

        const dbGameId = extractGameId(saveRes);
        if (!dbGameId) throw new Error("Backend did not return game ID");

        toast.update(toastId, {
          render: `Game created! Code: ${code}`,
          type: "success",
          isLoading: false,
          autoClose: 5000,
          onClose: () => router.push(`${redirectToWaitingRoom}?gameCode=${code}`),
        });
      } catch (err: unknown) {
        const message = getContractErrorMessage(err, "Failed to create game. Please try again.");
        toast.update(toastId, {
          render: message,
          type: "error",
          isLoading: false,
          autoClose: 8000,
        });
      }
      setIsStarting(false);
    },
    [
      isStarting,
      isGuest,
      isMiniPay,
      chainName,
      router,
      redirectToWaitingRoom,
      address,
      username,
      isUserRegistered,
      contractAddress,
      stakeTokenLoading,
      stakeTokenAddress,
      refetchAllowance,
      stakeAllowance,
      approveUSDC,
      createGame,
    ]
  );

  const handleInitiate = () => {
    playGuard.submit(() =>
      createMatch({
        settings,
        free: isFreeGame || isGuest,
        code: gameCode,
      })
    );
  };

  const canCreate = isGuest || (address && username && isUserRegistered);
  const isLaunching =
    playGuard.isSubmitting || isStarting || approvePending || approveConfirming || (!isGuest && isCreatePending);

  const handleQuickStart = () => {
    if (isLaunching) return;
    const quick: SettingsState = {
      ...DEFAULT_SETTINGS,
      symbol: pickRandomPiece(),
      maxPlayers: 4,
      privateRoom: false,
      startingCash: 1500,
      duration: 30,
      auction: true,
      rentInPrison: true,
      mortgage: true,
      evenBuild: true,
      stake: 0,
    };
    setSettings(quick);
    setIsFreeGame(true);
    setCustomStake("");
    setGameCode(generateGameCode());
    setPendingLaunch({ free: true });
  };

  useEffect(() => {
    if (!pendingLaunch) return;
    const free = pendingLaunch.free;
    setPendingLaunch(null);
    playGuard.submit(() =>
      createMatch({
        settings,
        free: free || isGuest,
        code: gameCode,
      })
    );
    // Intentionally run once per pendingLaunch flush (settings/gameCode already updated in same render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLaunch]);

  const selectedPiece = GamePieces.find((p) => p.id === settings.symbol);
  const stakeLabel = isGuest || isFreeGame ? "Free" : `${finalStake} USDT`;
  const houseOnCount = HOUSE_RULES.filter((r) => settings[r.key]).length;

  const primaryPieces = useMemo(() => GamePieces.slice(0, 4), []);

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0A1628]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(0,212,255,0.16),transparent_42%),radial-gradient(ellipse_at_90%_10%,rgba(40,90,200,0.12),transparent_40%),linear-gradient(180deg,#0A1628_0%,#07111c_50%,#040a12_100%)]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.55) 4px)",
        }}
      />

      {/* Persistent page header */}
      <header className="sticky top-0 z-40 border-b border-[#00D4FF]/20 bg-[#0A1628]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="relative mx-auto flex h-14 max-w-md items-center justify-between px-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Close"
            className="relative z-[1] flex h-11 w-11 items-center justify-center rounded-xl border border-[#00D4FF]/25 text-[#00D4FF] transition hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/10"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-[1] flex items-center justify-center">
            <div className="pointer-events-auto">
              {showOnlineInHeader ? (
                <WhoIsOnlineControl username={headerUsername} />
              ) : (
                <h1 className="font-orbitron text-base font-bold uppercase tracking-[0.2em] text-white">
                  <span className="bg-gradient-to-r from-[#00D4FF] to-[#6ec8ff] bg-clip-text text-transparent">
                    Tycoon
                  </span>
                </h1>
              )}
            </div>
          </div>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-[1] inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#00D4FF]/25 px-3 font-dmSans text-xs font-medium text-[#9ad8e4] transition hover:border-[#00D4FF]/50 hover:text-[#00D4FF]"
          >
            <LifeBuoy className="h-4 w-4" />
            Support
          </a>
        </div>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-28 pt-4">
        {/* Quick Start */}
        <motion.button
          type="button"
          onClick={handleQuickStart}
          disabled={isLaunching}
          whileTap={{ scale: 0.98 }}
          className="relative mb-5 w-full overflow-hidden rounded-2xl border-2 border-[#00D4FF]/60 bg-gradient-to-r from-[#00D4FF]/20 via-[#0a2a3a] to-[#1a4a8a]/30 px-4 py-5 text-left shadow-[0_0_36px_rgba(0,212,255,0.35)] disabled:opacity-50"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(0,212,255,0.25),transparent_55%)]" />
          <CornerBrackets active />
          <p className="relative font-orbitron text-base font-black uppercase tracking-wide text-[#e8fbff]">
            ⚡ Quick Start — Jump In Now
          </p>
          <p className="relative mt-1 font-dmSans text-xs text-[#9ad8e4]/90">
            Random piece · 4 players · $1500 · 30m · free public room
          </p>
        </motion.button>

        <div className="mb-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#00D4FF]/35 to-transparent" />
          <span className="shrink-0 font-dmSans text-[11px] text-[#6a8490]">or customize your match</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#00D4FF]/35 to-transparent" />
        </div>

        {/* Piece */}
        <section className="mb-5">
          <SectionLabel>Your piece</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {primaryPieces.map((piece) => {
              const selected = settings.symbol === piece.id;
              return (
                <motion.button
                  key={piece.id}
                  type="button"
                  onClick={() => setSettings((p) => ({ ...p, symbol: piece.id }))}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition ${
                    selected
                      ? "border-[#00D4FF] bg-[#00D4FF]/12 shadow-[0_0_20px_rgba(0,212,255,0.28)]"
                      : "border-[#00D4FF]/15 bg-[#0a1520]/70"
                  }`}
                >
                  <CornerBrackets active={selected} />
                  <motion.span
                    animate={selected ? { scale: [1, 1.2, 1], y: [0, -4, 0] } : { scale: 1, y: 0 }}
                    transition={
                      selected
                        ? { duration: 0.55, repeat: Infinity, repeatDelay: 1.2 }
                        : { duration: 0.15 }
                    }
                    className="text-2xl drop-shadow-[0_0_10px_rgba(0,212,255,0.5)]"
                  >
                    {PIECE_EMOJI[piece.id]}
                  </motion.span>
                  <span className="font-dmSans text-[11px] capitalize text-[#c8e6ec]">
                    {piece.name.toLowerCase()}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Max players */}
        <section className="mb-5">
          <SectionLabel>Max players</SectionLabel>
          <HudPanel>
            <div className="grid grid-cols-6 gap-1.5 p-3">
              {[2, 3, 4, 5, 6, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSettings((p) => ({ ...p, maxPlayers: num }))}
                  className={`flex min-h-11 items-center justify-center rounded-lg border font-orbitron text-sm font-bold transition ${
                    settings.maxPlayers === num
                      ? "border-[#00D4FF] bg-[#00D4FF]/20 text-[#00D4FF]"
                      : "border-white/10 bg-black/20 text-[#7a93a0]"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-1.5 px-3 pb-3">
              {[...Array(7)].map((_, idx) => (
                <div
                  key={idx}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-sm transition ${
                    idx < settings.maxPlayers
                      ? "border-[#00D4FF]/50 bg-[#00D4FF]/10 text-[#00D4FF]"
                      : "border-white/5 bg-black/20 text-white/15"
                  }`}
                >
                  👤
                </div>
              ))}
            </div>
          </HudPanel>
        </section>

        {/* Starting cash */}
        <section className="mb-5">
          <SectionLabel>Starting cash</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[500, 1000, 1500, 2000].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setSettings((p) => ({ ...p, startingCash: amount }))}
                className={`relative flex min-h-12 items-center justify-center rounded-xl border font-dmSans text-sm font-semibold transition ${
                  settings.startingCash === amount
                    ? "border-[#00D4FF] bg-[#00D4FF]/15 text-[#e8fbff]"
                    : "border-[#00D4FF]/15 bg-[#0a1520]/70 text-[#8aa4b0]"
                }`}
              >
                <CornerBrackets active={settings.startingCash === amount} />
                ${amount.toLocaleString()}
              </button>
            ))}
          </div>
        </section>

        {/* Duration */}
        <section className="mb-5">
          <SectionLabel>Game duration</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 30, label: "30m" },
              { value: 45, label: "45m" },
              { value: 60, label: "60m" },
              { value: 90, label: "90m" },
              { value: 0, label: "No limit" },
            ].map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setSettings((p) => ({ ...p, duration: d.value }))}
                className={`relative flex min-h-11 items-center rounded-full border px-3.5 font-dmSans text-sm transition ${
                  settings.duration === d.value
                    ? "border-[#00D4FF] bg-[#00D4FF]/15 text-[#00D4FF]"
                    : "border-[#00D4FF]/15 bg-[#0a1520]/70 text-[#8aa4b0]"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Room access */}
        <section className="mb-5">
          <SectionLabel>Room access</SectionLabel>
          <HudPanel>
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                onClick={() => setSettings((p) => ({ ...p, privateRoom: false }))}
                className={`relative flex min-h-12 items-center justify-center gap-2 rounded-lg border transition ${
                  !settings.privateRoom
                    ? "border-[#00D4FF] bg-[#00D4FF]/15 text-[#00D4FF]"
                    : "border-white/10 bg-black/25 text-[#7a93a0]"
                }`}
              >
                <CornerBrackets active={!settings.privateRoom} />
                <LockOpen className="h-4 w-4" />
                <span className="font-orbitron text-[11px] font-bold uppercase">Public</span>
              </button>
              <button
                type="button"
                onClick={() => setSettings((p) => ({ ...p, privateRoom: true }))}
                className={`relative flex min-h-12 items-center justify-center gap-2 rounded-lg border transition ${
                  settings.privateRoom
                    ? "border-[#00D4FF] bg-[#00D4FF]/15 text-[#00D4FF]"
                    : "border-white/10 bg-black/25 text-[#7a93a0]"
                }`}
              >
                <CornerBrackets active={settings.privateRoom} />
                <Lock className="h-4 w-4" />
                <span className="font-orbitron text-[11px] font-bold uppercase">Private</span>
              </button>
            </div>
            <p className="px-3 pb-3 font-dmSans text-[11px] text-[#6a8490]">
              {settings.privateRoom
                ? "Only players you invite with the code can join."
                : "Anyone with the invite code can join."}
            </p>
          </HudPanel>
        </section>

        {/* Game type & stake */}
        <section className="mb-5">
          <SectionLabel>Game type & stake</SectionLabel>
          {isGuest ? (
            <HudPanel active>
              <div className="p-3.5">
                <p className="font-orbitron text-xs font-bold uppercase tracking-wider text-amber-200">
                  Guest games are free
                </p>
                <p className="mt-1 font-dmSans text-xs text-[#8aa4b0]">
                  Connect a wallet later to host staked matches.
                </p>
              </div>
            </HudPanel>
          ) : (
            <HudPanel active={!isFreeGame}>
              <div className="p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFreeGame(true);
                      setCustomStake("");
                    }}
                    className={`relative flex min-h-12 flex-col items-center justify-center rounded-lg border transition ${
                      isFreeGame
                        ? "border-[#00D4FF] bg-[#00D4FF]/15 text-[#00D4FF]"
                        : "border-white/10 bg-black/25 text-[#7a93a0]"
                    }`}
                  >
                    <CornerBrackets active={isFreeGame} />
                    <span className="font-orbitron text-[11px] font-bold uppercase">Free</span>
                    <span className="font-dmSans text-[10px] opacity-80">No entry fee</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFreeGame(false);
                      if (settings.stake < 0.01) setSettings((p) => ({ ...p, stake: 5 }));
                    }}
                    className={`relative flex min-h-12 flex-col items-center justify-center rounded-lg border transition ${
                      !isFreeGame
                        ? "border-emerald-400/70 bg-emerald-500/15 text-emerald-300"
                        : "border-white/10 bg-black/25 text-[#7a93a0]"
                    }`}
                  >
                    <CornerBrackets active={!isFreeGame} />
                    <span className="font-orbitron text-[11px] font-bold uppercase">Staked</span>
                    <span className="font-dmSans text-[10px] opacity-80">USDT entry</span>
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {!isFreeGame && (
                    <motion.div
                      key="stake"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 grid grid-cols-3 gap-1.5">
                        {stakePresets.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => {
                              setSettings((p) => ({ ...p, stake: amount }));
                              setCustomStake("");
                            }}
                            className={`flex min-h-11 items-center justify-center rounded-lg border font-orbitron text-sm font-bold ${
                              settings.stake === amount && !customStake
                                ? "border-amber-300 bg-gradient-to-br from-amber-300 to-amber-500 text-[#1a1200]"
                                : "border-white/10 bg-black/30 text-[#c5d8e0]"
                            }`}
                          >
                            {amount}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Custom USDT"
                        value={customStake}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCustomStake(v);
                          const num = Number(v);
                          if (!Number.isNaN(num) && num >= 0.01) {
                            setSettings((p) => ({ ...p, stake: num }));
                          }
                        }}
                        className="mt-2 min-h-11 w-full rounded-lg border border-emerald-500/40 bg-black/40 px-3 text-center font-dmSans text-sm text-white outline-none placeholder:text-[#5a7380] focus:border-emerald-400"
                      />
                      <p className="mt-1.5 text-center font-dmSans text-xs text-emerald-300/90">
                        Each player stakes {settings.stake} USDT
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </HudPanel>
          )}
        </section>

        {/* House rules accordion */}
        <section className="mb-4">
          <button
            type="button"
            onClick={() => setHouseRulesOpen((o) => !o)}
            className="flex min-h-12 w-full items-center justify-between rounded-xl border border-[#00D4FF]/20 bg-[#0a1520]/80 px-3.5 text-left"
          >
            <div>
              <p className="font-orbitron text-[11px] font-bold uppercase tracking-[0.16em] text-[#00D4FF]/85">
                House rules
              </p>
              <p className="font-dmSans text-[11px] text-[#6a8490]">
                {houseOnCount} of {HOUSE_RULES.length} on
              </p>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-[#00D4FF]/70 transition ${houseRulesOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence initial={false}>
            {houseRulesOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {HOUSE_RULES.map((rule) => {
                    const active = Boolean(settings[rule.key]);
                    const Icon = rule.Icon;
                    const open = hintKey === rule.key;
                    return (
                      <HudPanel key={rule.key} active={active}>
                        <div className="flex items-center gap-3 p-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                              active
                                ? "border-[#00D4FF]/40 bg-[#00D4FF]/15 text-[#00D4FF]"
                                : "border-white/10 bg-black/25 text-[#6a8490]"
                            }`}
                          >
                            <Icon className="h-5 w-5" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-dmSans text-sm font-semibold text-[#e8f4f7]">
                                {rule.label}
                              </p>
                              <button
                                type="button"
                                aria-label={`About ${rule.label}`}
                                onClick={() => setHintKey(open ? null : rule.key)}
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-[#00D4FF]/25 text-[#00D4FF]/80"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <AnimatePresence>
                              {open && (
                                <motion.p
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-1 overflow-hidden font-dmSans text-[11px] leading-snug text-[#8aa4b0]"
                                >
                                  {rule.hint}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            onClick={() =>
                              setSettings((p) => ({ ...p, [rule.key]: !p[rule.key] }))
                            }
                            className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition ${
                              active
                                ? "border-[#00D4FF] bg-gradient-to-r from-cyan-600 to-cyan-400"
                                : "border-white/15 bg-[#1a2430]"
                            }`}
                          >
                            <motion.span
                              animate={{ x: active ? 22 : 2 }}
                              transition={{ type: "spring", stiffness: 500, damping: 28 }}
                              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                            />
                          </button>
                        </div>
                      </HudPanel>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#00D4FF]/20 bg-[#0A1628]/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <span className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#00D4FF]/20 bg-[#0a1a26] px-2 font-dmSans text-[11px] text-[#c5e8ef]">
              <span>{PIECE_EMOJI[settings.symbol]}</span>
              {selectedPiece?.name ?? "Piece"}
            </span>
            <span className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#00D4FF]/20 bg-[#0a1a26] px-2 font-dmSans text-[11px] text-[#c5e8ef]">
              <Users className="h-3 w-3" />
              {settings.maxPlayers}p
            </span>
            <span className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#00D4FF]/20 bg-[#0a1a26] px-2 font-dmSans text-[11px] text-[#c5e8ef]">
              {stakeLabel}
            </span>
          </div>
          <button
            type="button"
            disabled={!canCreate || isLaunching}
            onClick={handleInitiate}
            className="flex min-h-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#00D4FF]/60 bg-gradient-to-r from-[#00D4FF] to-[#3aa8ff] px-3.5 font-orbitron text-xs font-bold uppercase tracking-wide text-[#041018] shadow-[0_0_24px_rgba(0,212,255,0.4)] transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLaunching ? "…" : "⚡ Initiate Match"}
          </button>
        </div>
      </div>
    </div>
  );
}
