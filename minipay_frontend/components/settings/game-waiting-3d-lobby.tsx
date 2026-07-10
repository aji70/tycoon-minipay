"use client";

import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useWaitingRoom } from "./useWaitingRoom";
import GameRoomLoading from "./game-room-loading";
import { Check, Copy, LifeBuoy, Users, X } from "lucide-react";
import WhoIsOnlineControl from "@/components/shared/WhoIsOnlineControl";
import { canAccessMultiplayerPreview } from "@/lib/featureAccess";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";
import { ParticleBackground } from "@/components/hero/ParticleBackground";
import { WARoomLaunchButton } from "@/components/game-setup/WARoomLaunchButton";
import type { Player } from "@/types/game";

const REDIRECT_TO_BOARD = "/board-3d-multi-mobile";
const COPY_FEEDBACK_MS = 2000;
const SUPPORT_URL = "https://t.me/+xJLEjw9tbyQwMGVk";

function CornerBrackets({ active }: { active?: boolean }) {
  const c = active ? "border-[#00D4FF]" : "border-[#00D4FF]/30";
  return (
    <>
      <span className={`pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 ${c}`} />
      <span className={`pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 ${c}`} />
      <span className={`pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 ${c}`} />
      <span className={`pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 ${c}`} />
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 flex items-center justify-center gap-1.5 font-orbitron text-[10px] font-bold uppercase tracking-[0.2em] text-[#00D4FF]/80">
      {children}
    </p>
  );
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
    const el = document.createElement("textarea");
    el.value = value;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    return true;
  } catch {
    return false;
  }
}

/** 3D game waiting room. Redirects to /board-3d-multi-mobile when the game starts. */
export default function GameWaiting3DLobby(): React.ReactElement {
  const {
    router,
    gameCode,
    game,
    loading,
    contractGameLoading,
    error,
    playerSymbol,
    setPlayerSymbol,
    availableSymbols,
    isJoined,
    actionLoading,
    approvePending,
    approveConfirming,
    playersJoined,
    maxPlayers,
    handleJoinGame,
    handleLeaveGame,
    handleGoHome,
    guestCannotJoinStaked,
    symbols,
    stakePerPlayer,
    isJoining,
    joinError,
    contractGameError,
    guestUser,
    username: waitingUsername,
  } = useWaitingRoom({ redirectToBoard: REDIRECT_TO_BOARD });

  const headerUsername = guestUser?.username ?? waitingUsername ?? null;
  const showOnlineInHeader = canAccessMultiplayerPreview(headerUsername);

  const gameUrl3d = useMemo(() => {
    if (!gameCode) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/game-waiting-3d?gameCode=${encodeURIComponent(gameCode)}`;
  }, [gameCode]);

  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [playersSheetOpen, setPlayersSheetOpen] = useState(false);

  const flashCopy = useCallback((msg: string) => {
    setCopyFeedback(msg);
    window.setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_MS);
  }, []);

  const handleCopyCode = useCallback(async () => {
    if (!gameCode) return;
    const ok = await copyText(gameCode);
    flashCopy(ok ? "Code copied!" : "Copy failed");
  }, [gameCode, flashCopy]);

  const handleCopyLink = useCallback(async () => {
    if (!gameUrl3d) return;
    const ok = await copyText(gameUrl3d);
    flashCopy(ok ? "Link copied!" : "Copy failed");
  }, [gameUrl3d, flashCopy]);

  const joinLoading = actionLoading || isJoining || approvePending || approveConfirming;
  const slotsOpen = playersJoined < maxPlayers;
  const players: Player[] = game?.players ?? [];
  const showViewAll = maxPlayers > 4 || players.length > 0;

  if (loading || contractGameLoading) {
    return <GameRoomLoading variant="waiting" />;
  }

  if (error || !game) {
    return (
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[#0A1628] px-4">
        <ScanlineOverlay />
        <p className="relative z-20 mb-4 text-center text-red-400">{error ?? "Game not found"}</p>
        <button
          type="button"
          onClick={() =>
            gameCode
              ? router.push(`/game-waiting-3d?gameCode=${encodeURIComponent(gameCode)}`)
              : handleGoHome()
          }
          className="relative z-20 rounded-full border border-cyan-500/50 bg-cyan-500/10 px-4 py-2.5 font-orbitron text-sm text-cyan-400"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={handleGoHome}
          className="relative z-20 mt-3 rounded-full border border-slate-600 bg-slate-800/80 px-4 py-2.5 text-sm text-slate-200"
        >
          Home
        </button>
      </section>
    );
  }

  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#0A1628]">
      <ParticleBackground />
      <ScanlineOverlay />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(0,212,255,0.14),transparent_45%),radial-gradient(ellipse_at_85%_15%,rgba(40,90,200,0.1),transparent_40%)]" />

      {/* Persistent header */}
      <header className="sticky top-0 z-40 border-b border-[#00D4FF]/20 bg-[#0A1628]/95 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="relative mx-auto flex h-14 max-w-md items-center justify-between px-3">
          <button
            type="button"
            onClick={handleGoHome}
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

      <div className="relative z-20 mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-8 pt-5">
        {/* Title block */}
        <div className="mb-5 text-center">
          <motion.div
            className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.span
              className="h-2 w-2 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.45, 1], opacity: [1, 0.45, 1] }}
              transition={{ repeat: Infinity, duration: 1.15 }}
            />
            <span className="font-orbitron text-[10px] font-bold tracking-widest text-emerald-400">
              LIVE
            </span>
          </motion.div>
          <motion.h2
            className="font-orbitron text-3xl font-black tracking-wider text-[#7ee8ff]"
            animate={{
              textShadow: [
                "0 0 18px rgba(0,212,255,0.35)",
                "0 0 36px rgba(0,212,255,0.7)",
                "0 0 18px rgba(0,212,255,0.35)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 2.6 }}
          >
            ⚔️ WAR ROOM
          </motion.h2>
          <p className="mt-2 font-dmSans text-xs text-[#8aa4b0]">
            Waiting for players · Game starts when all seats are filled
          </p>
        </div>

        {/* Access code hero */}
        <motion.button
          type="button"
          onClick={handleCopyCode}
          whileTap={{ scale: 0.98 }}
          className="relative mb-3 w-full overflow-hidden rounded-2xl border border-[#00D4FF]/45 bg-[linear-gradient(160deg,rgba(8,28,44,0.95),rgba(4,14,24,0.95))] px-4 py-6 text-center shadow-[0_0_32px_rgba(0,212,255,0.2)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,212,255,0.18),transparent_60%)]" />
          <CornerBrackets active />
          <p className="relative mb-2 font-orbitron text-[10px] font-bold uppercase tracking-[0.28em] text-[#00D4FF]/75">
            Access code · tap to copy
          </p>
          <motion.p
            className="relative font-mono text-4xl font-black tracking-[0.28em] text-[#b8f4ff]"
            animate={{
              textShadow: [
                "0 0 16px rgba(0,212,255,0.45)",
                "0 0 32px rgba(0,212,255,0.85)",
                "0 0 16px rgba(0,212,255,0.45)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 2.2 }}
          >
            {gameCode}
          </motion.p>
          <p className="relative mt-2 inline-flex items-center gap-1.5 font-dmSans text-[11px] text-[#7ec8d4]">
            {copyFeedback?.includes("Code") ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                {copyFeedback}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Share this code with friends
              </>
            )}
          </p>
        </motion.button>

        {/* Share battle link */}
        <div className="mb-5">
          <SectionLabel>Share battle link</SectionLabel>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              readOnly
              value={gameUrl3d}
              aria-label="Join game URL"
              className="min-w-0 flex-1 truncate rounded-xl border border-[#00D4FF]/20 bg-[#050a0b] px-3 py-3 font-mono text-xs text-cyan-200/90 shadow-inner focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={actionLoading || !gameUrl3d}
              className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#00D4FF]/50 bg-[#00D4FF]/10 text-[#00D4FF] transition hover:shadow-[0_0_16px_rgba(0,212,255,0.45)] disabled:opacity-40"
              title="Copy link"
              aria-label="Copy battle link"
            >
              {copyFeedback?.includes("Link") ? (
                <Check className="h-5 w-5 text-emerald-400" />
              ) : (
                <Copy className="h-5 w-5" />
              )}
            </button>
          </div>
          {copyFeedback?.includes("Link") && (
            <p className="mt-1.5 text-center font-orbitron text-xs text-emerald-400">{copyFeedback}</p>
          )}
        </div>

        {/* Combatants */}
        <div className="mb-5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="font-orbitron text-[10px] font-bold uppercase tracking-[0.2em] text-[#00D4FF]/80">
              Combatants
            </p>
            <p className="font-orbitron text-sm text-slate-300">
              <span className="font-bold text-[#00D4FF]">{playersJoined}</span>
              <span className="text-slate-500"> / </span>
              <span className="text-slate-400">{maxPlayers}</span>
            </p>
          </div>

          <div className="mb-3 flex flex-wrap justify-center gap-2.5">
            {Array.from({ length: maxPlayers }).map((_, i) => {
              const p = players[i];
              const sym = p ? symbols.find((s) => s.value === p.symbol) : null;
              const filled = !!p;

              if (filled) {
                return (
                  <motion.div
                    key={`seat-${i}-${p.user_id}`}
                    initial={{ scale: 0.75, opacity: 0 }}
                    animate={{
                      scale: 1,
                      opacity: 1,
                      boxShadow: [
                        "0 0 10px rgba(0,212,255,0.25)",
                        "0 0 22px rgba(0,212,255,0.55)",
                        "0 0 10px rgba(0,212,255,0.25)",
                      ],
                    }}
                    transition={{
                      scale: { duration: 0.35 },
                      boxShadow: { repeat: Infinity, duration: 2.2 },
                    }}
                    className="relative flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center rounded-xl border-2 border-[#00D4FF] bg-[#00D4FF]/15"
                  >
                    <CornerBrackets active />
                    <span className="text-2xl">{sym?.emoji ?? "⚔️"}</span>
                    <span className="mt-0.5 max-w-[3.5rem] truncate px-0.5 font-dmSans text-[9px] text-[#9ad8e4]">
                      {p.username || "Player"}
                    </span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={`empty-${i}`}
                  className="flex h-[4.25rem] w-[4.25rem] items-center justify-center rounded-xl border-2 border-dashed border-amber-500/45 bg-amber-950/15"
                  animate={{
                    borderColor: [
                      "rgba(245, 158, 11, 0.3)",
                      "rgba(245, 158, 11, 0.85)",
                      "rgba(245, 158, 11, 0.3)",
                    ],
                    opacity: [0.65, 1, 0.65],
                  }}
                  transition={{ repeat: Infinity, duration: 1.7, delay: i * 0.12 }}
                >
                  <span className="px-1 text-center font-orbitron text-[8px] font-bold leading-tight text-amber-400/90">
                    Seat {i + 1}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {showViewAll && (
            <button
              type="button"
              onClick={() => setPlayersSheetOpen(true)}
              className="mb-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/8 px-2 font-dmSans text-xs text-[#9ad8e4] transition hover:border-[#00D4FF]/55 hover:text-[#00D4FF]"
            >
              <Users className="h-3.5 w-3.5 shrink-0" />
              Room players
            </button>
          )}

          {slotsOpen && (
            <p className="flex items-center justify-center gap-2 font-dmSans text-xs text-amber-400/85">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-amber-400"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ repeat: Infinity, duration: 1.1 }}
              />
              <span>
                Waiting for opponent to join
                <motion.span
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                >
                  …
                </motion.span>
              </span>
            </p>
          )}
        </div>

        {/* Join: piece + enter battle */}
        {!isJoined && game.players.length < maxPlayers && (
          <div className="mb-5 space-y-4">
            <SectionLabel>Select your piece</SectionLabel>
            <div className="-mx-1 overflow-x-auto px-1 pb-2">
              <div className="flex min-w-min gap-2">
                {availableSymbols.map((piece, idx) => {
                  const selected = playerSymbol?.value === piece.value;
                  return (
                    <motion.button
                      key={piece.value}
                      type="button"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.04 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPlayerSymbol(piece)}
                      className={`relative flex h-20 w-[4.5rem] flex-shrink-0 flex-col items-center justify-center rounded-xl border-2 transition-all ${
                        selected
                          ? "border-[#00D4FF] bg-[#00D4FF]/20 shadow-[0_0_20px_rgba(0,212,255,0.45)]"
                          : "border-[#00D4FF]/25 bg-slate-900/60"
                      }`}
                    >
                      <motion.span
                        animate={selected ? { scale: [1, 1.15, 1], y: [0, -2, 0] } : {}}
                        transition={
                          selected
                            ? { duration: 0.55, repeat: Infinity, repeatDelay: 1.2 }
                            : undefined
                        }
                        className="mb-0.5 text-2xl"
                      >
                        {piece.emoji}
                      </motion.span>
                      <span className="px-0.5 text-center font-orbitron text-[8px] font-bold uppercase leading-tight text-cyan-300/90">
                        {piece.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            {guestCannotJoinStaked && (
              <p className="text-center font-dmSans text-sm text-amber-400">
                Connect a wallet to join this staked game.
              </p>
            )}
            <WARoomLaunchButton
              onClick={handleJoinGame}
              disabled={!playerSymbol || joinLoading || guestCannotJoinStaked}
              isSubmitting={joinLoading}
              approvePending={approvePending}
              approveConfirming={approveConfirming}
              canCreate={!guestCannotJoinStaked}
              text="ENTER BATTLE"
            />
          </div>
        )}

        {isJoined && game.players.length < maxPlayers && (
          <button
            type="button"
            onClick={handleLeaveGame}
            disabled={actionLoading}
            className="mb-4 w-full rounded-xl border border-red-500/55 py-3 font-orbitron text-sm tracking-wide text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {actionLoading ? "Leaving…" : "Leave War Room"}
          </button>
        )}

        {stakePerPlayer > BigInt(0) && (
          <p className="mb-4 text-center font-orbitron text-sm text-amber-400/90">
            Stake: {Number(stakePerPlayer) / 1e6} USDT
          </p>
        )}

        {(error || guestCannotJoinStaked || joinError || contractGameError) && (
          <p className="mb-4 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-center font-dmSans text-sm text-red-400">
            {error ??
              (guestCannotJoinStaked ? "Connect a wallet to join this staked game." : null) ??
              joinError?.message ??
              contractGameError?.message ??
              "Something went wrong"}
          </p>
        )}

        <div className="flex justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleGoHome}
            className="min-h-11 rounded-full border border-slate-600/80 bg-slate-900/80 px-4 py-2 font-orbitron text-xs tracking-wide text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
          >
            Home
          </button>
          <a
            href="/join-room-3d"
            className="inline-flex min-h-11 items-center rounded-full border border-cyan-500/30 bg-cyan-500/5 px-4 py-2 font-orbitron text-xs tracking-wide text-cyan-400/90 transition hover:border-cyan-400/60 hover:text-cyan-300"
          >
            Join Another
          </a>
        </div>
      </div>

      {/* Players bottom sheet */}
      <AnimatePresence>
        {playersSheetOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close players list"
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPlayersSheetOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="combatants-sheet-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-[60] max-h-[75dvh] overflow-y-auto rounded-t-2xl border-t-2 border-[#00D4FF]/30 bg-gradient-to-b from-[#0c1c28] to-[#071018] pb-[env(safe-area-inset-bottom)]"
            >
              <div className="mx-auto max-w-md px-4 pb-6 pt-3">
                <div className="mb-4 flex justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-[#00D4FF]/50" />
                </div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3
                      id="combatants-sheet-title"
                      className="font-orbitron text-sm font-bold uppercase tracking-wider text-[#00D4FF]"
                    >
                      Room players
                    </h3>
                    <p className="font-dmSans text-xs text-[#8aa4b0]">
                      {playersJoined} of {maxPlayers} seats filled
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlayersSheetOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#00D4FF]/25 text-[#00D4FF]"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <ul className="space-y-2">
                  {Array.from({ length: maxPlayers }).map((_, i) => {
                    const p = players[i];
                    const sym = p ? symbols.find((s) => s.value === p.symbol) : null;
                    return (
                      <li
                        key={p ? `p-${p.user_id}` : `empty-row-${i}`}
                        className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 ${
                          p
                            ? "border-[#00D4FF]/35 bg-[#00D4FF]/10"
                            : "border-dashed border-amber-500/30 bg-amber-950/10"
                        }`}
                      >
                        <div
                          className={`flex h-11 w-11 items-center justify-center rounded-lg border text-xl ${
                            p
                              ? "border-[#00D4FF]/40 bg-[#0a1a26]"
                              : "border-amber-500/25 bg-black/20 text-amber-400/50"
                          }`}
                        >
                          {p ? (sym?.emoji ?? "⚔️") : "·"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-dmSans text-sm font-semibold text-[#e8f4f7]">
                            {p?.username ?? `Open seat ${i + 1}`}
                          </p>
                          <p className="font-dmSans text-[11px] text-[#8aa4b0]">
                            {p
                              ? `${sym?.name ?? p.symbol} · Ready in lobby`
                              : "Waiting for player"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 font-orbitron text-[9px] font-bold uppercase tracking-wide ${
                            p
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-500/10 text-amber-400/90"
                          }`}
                        >
                          {p ? "Ready" : "Open"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
