'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, Info, Loader2, Medal, Users, Zap } from 'lucide-react';
import type { BountyRow, TimeScope } from './leaderboard-types';
import { formatLeaderboardLastUpdated } from './leaderboard-types';
import { JulyBogoPromoBanner } from '@/components/promos/JulyBogoPromoBanner';

type TabId = TimeScope;

function ScopeTabs({
  timeScope,
  setTimeScope,
  bountyMonthLabel,
}: {
  timeScope: TimeScope;
  setTimeScope: (scope: TimeScope) => void;
  bountyMonthLabel: string;
}) {
  const tabs: { id: TabId; label: string; icon?: React.ReactNode }[] = [
    { id: 'bounty', label: `${bountyMonthLabel.split(' ')[0]} Bounty`, icon: '💰' },
    { id: 'month', label: 'Monthly', icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { id: 'all', label: 'All-time' },
  ];

  return (
    <div
      className="mb-5 rounded-xl border border-cyan-500/20 bg-[#061214]/90 p-1 flex gap-0.5"
      role="tablist"
      aria-label="Leaderboard time scope"
    >
      {tabs.map((tab) => {
        const active = timeScope === tab.id;
        const isBounty = tab.id === 'bounty';
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTimeScope(tab.id)}
            className={`flex-1 min-w-0 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-orbitron font-bold uppercase tracking-wide transition-all duration-200 inline-flex items-center justify-center gap-1 ${
              active
                ? isBounty
                  ? 'bg-amber-500/20 text-amber-100 border border-amber-400/50 shadow-[0_0_16px_rgba(251,191,36,0.2)]'
                  : 'bg-cyan-500/20 text-cyan-100 border border-cyan-400/50 shadow-[0_0_16px_rgba(0,240,255,0.2)]'
                : 'text-white/45 border border-transparent hover:text-white/70 hover:bg-white/[0.03]'
            }`}
          >
            {tab.icon}
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type RankCardTier = 'podium' | 'prize' | 'rest';

const PODIUM_META: Record<
  1 | 2 | 3,
  { medal: string; badge: string; badgeClass: string; rankClass: string; shellClass: string; glow?: string }
> = {
  1: {
    medal: '👑',
    badge: 'CHAMPION',
    badgeClass: 'border-amber-400/60 bg-amber-500/25 text-amber-100',
    rankClass: 'text-2xl text-amber-300',
    shellClass:
      'border-amber-400/80 bg-gradient-to-r from-amber-950/55 via-[#0a1518]/98 to-[#081517]/95 shadow-[0_0_36px_rgba(251,191,36,0.28)]',
    glow: 'bg-amber-400/12',
  },
  2: {
    medal: '🥈',
    badge: 'ELITE',
    badgeClass: 'border-slate-300/55 bg-slate-400/20 text-slate-100',
    rankClass: 'text-xl text-slate-100',
    shellClass:
      'border-slate-300/55 bg-gradient-to-r from-slate-500/10 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_22px_rgba(203,213,225,0.12)]',
  },
  3: {
    medal: '🥉',
    badge: 'VETERAN',
    badgeClass: 'border-orange-500/50 bg-orange-500/15 text-orange-200',
    rankClass: 'text-xl text-orange-300',
    shellClass:
      'border-orange-500/50 bg-gradient-to-r from-orange-950/45 via-[#081517]/95 to-[#081517]/90 shadow-[0_0_18px_rgba(234,88,12,0.14)]',
  },
};

function RankCard({
  row,
  rank,
  isMe,
  tier,
  bountyMode,
  bountyWinnerCount,
  bountyPrizeUsd,
}: {
  row: BountyRow;
  rank: number;
  isMe: boolean;
  tier: RankCardTier;
  bountyMode: boolean;
  bountyWinnerCount: number;
  bountyPrizeUsd: number | null;
}) {
  const isPodium = tier === 'podium' && rank >= 1 && rank <= 3;
  const podium = isPodium ? PODIUM_META[rank as 1 | 2 | 3] : null;
  const isDense = tier === 'rest' || tier === 'prize';
  const inBountyPrize = bountyMode && rank <= bountyWinnerCount;

  let shellClass = isDense
    ? 'border-white/[0.06] bg-[#061214]/75 opacity-90'
    : 'border-white/10 bg-[#081517]/90';

  if (podium) shellClass = podium.shellClass;
  if (isMe) {
    shellClass =
      'border-cyan-400/65 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,240,255,0.18)] ring-1 ring-cyan-400/25';
  }

  const rankClass = podium
    ? podium.rankClass
    : isDense
      ? 'text-sm text-white/55 tabular-nums'
      : rank <= 3
        ? 'text-lg text-cyan-300/90'
        : 'text-base text-cyan-300/80';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(rank * 0.025, 0.5) }}
      className={`relative rounded-xl border backdrop-blur-sm ${shellClass} ${isPodium ? 'scale-[1.02]' : ''}`}
    >
      {podium?.glow && (
        <div className={`pointer-events-none absolute -inset-3 rounded-2xl blur-2xl opacity-80 ${podium.glow}`} aria-hidden />
      )}
      <div
        className={`relative flex items-center gap-2.5 ${
          isPodium ? 'px-4 py-4' : isDense ? 'px-3 py-2' : 'px-3.5 py-3'
        }`}
      >
        <div className={`flex items-center gap-1 shrink-0 ${isPodium ? 'w-14' : 'w-11'}`}>
          {podium ? (
            <span className="text-lg leading-none" aria-hidden>
              {podium.medal}
            </span>
          ) : null}
          <span className={`font-black tabular-nums ${rankClass}`}>#{rank}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`font-semibold text-white truncate ${
                isPodium ? 'text-base' : isDense ? 'text-sm text-white/85' : 'text-sm'
              }`}
            >
              {row.username || '—'}
            </span>
            {isMe && (
              <span className="shrink-0 text-[9px] font-orbitron font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-cyan-400/50 bg-cyan-500/20 text-cyan-100">
                YOU
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1">
          {podium && (
            <span
              className={`text-[9px] font-orbitron font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${podium.badgeClass}`}
            >
              {podium.badge}
            </span>
          )}
          {inBountyPrize && bountyPrizeUsd != null && (
            <span className="text-[9px] font-orbitron font-bold uppercase tracking-wider text-amber-400/90 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10">
              ${bountyPrizeUsd}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function YourRankStrip({
  myPosition,
  myLeaderboardUsernames,
  loading,
}: {
  myPosition: number;
  myLeaderboardUsernames: Set<string>;
  loading: boolean;
}) {
  if (myLeaderboardUsernames.size === 0 || loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-xl border border-cyan-500/25 bg-[#061a1c]/80 px-4 py-3 flex items-center gap-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-400/30">
        {myPosition > 0 ? (
          <Zap className="h-4 w-4 text-amber-300" />
        ) : (
          <Medal className="h-4 w-4 text-white/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-orbitron uppercase tracking-widest text-cyan-400/70">Your standing</p>
        {myPosition > 0 ? (
          <p className="text-sm font-bold font-orbitron text-amber-100">
            Rank <span className="text-amber-300">#{myPosition}</span>
          </p>
        ) : (
          <p className="text-sm text-white/65">Not on the board yet — finish more games to rank.</p>
        )}
      </div>
    </motion.div>
  );
}

export type LeaderboardViewProps = {
  chainParam: string;
  timeScope: TimeScope;
  setTimeScope: (scope: TimeScope) => void;
  monthKey: string;
  setMonthKey: (key: string) => void;
  monthOptions: { value: string; label: string }[];
  infoLabel: string;
  loading: boolean;
  error: string | null;
  rows: BountyRow[];
  myPosition: number;
  myLeaderboardUsernames: Set<string>;
  onRetry: () => void;
  bountyMonthLabel: string;
  bountyCompleted: boolean;
  bountyWinnerCount: number;
  bountyPrizeUsd: number | null;
  isFeaturedBountyView: boolean;
  lastUpdatedAt: string | null;
};

export function LeaderboardView({
  chainParam,
  timeScope,
  setTimeScope,
  monthKey,
  setMonthKey,
  monthOptions,
  infoLabel,
  loading,
  error,
  rows,
  myPosition,
  myLeaderboardUsernames,
  onRetry,
  bountyMonthLabel,
  bountyWinnerCount,
  bountyPrizeUsd,
  isFeaturedBountyView,
  lastUpdatedAt,
}: LeaderboardViewProps) {
  const bountyMode = isFeaturedBountyView;
  const lastUpdatedLabel = formatLeaderboardLastUpdated(lastUpdatedAt);
  const { eligibleRows, ineligibleRows } = useMemo(() => {
    const eligible = rows.filter((r) => r.leaderboard_eligible !== false);
    const ineligible = rows.filter((r) => r.leaderboard_eligible === false);
    return { eligibleRows: eligible, ineligibleRows: ineligible };
  }, [rows]);

  const gridBgStyle = {
    backgroundImage: `
      linear-gradient(0deg, transparent 24%, rgba(0, 240, 255, 0.04) 25%, rgba(0, 240, 255, 0.04) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.04) 75%, rgba(0, 240, 255, 0.04) 76%, transparent 77%, transparent),
      linear-gradient(90deg, transparent 24%, rgba(0, 240, 255, 0.04) 25%, rgba(0, 240, 255, 0.04) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.04) 75%, rgba(0, 240, 255, 0.04) 76%, transparent 77%, transparent)
    `,
    backgroundSize: '48px 48px',
  } as const;

  function cardTier(rank: number, mode: boolean): RankCardTier {
    if (!mode) return rank <= 3 ? 'podium' : 'rest';
    if (rank <= 3) return 'podium';
    if (rank <= bountyWinnerCount) return 'prize';
    return 'rest';
  }

  function renderList(mode: boolean) {
    const prizeRows = mode ? eligibleRows.slice(0, bountyWinnerCount) : eligibleRows;
    const restRows = mode ? eligibleRows.slice(bountyWinnerCount) : [];

    return (
      <>
        {mode && prizeRows.length > 0 && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <Medal className="h-3.5 w-3.5 text-amber-400/80" />
            <span className="text-[10px] font-orbitron font-bold uppercase tracking-[0.2em] text-amber-200/70">
              Prize zone · top {bountyWinnerCount}
            </span>
          </div>
        )}

        <div className={`${mode ? 'space-y-2.5' : 'space-y-2'}`}>
          {prizeRows.map((row, idx) => {
            const rank = idx + 1;
            const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
            return (
              <RankCard
                key={`${row.id}-${rank}`}
                row={row}
                rank={rank}
                isMe={isMe}
                tier={cardTier(rank, mode)}
                bountyMode={mode}
                bountyWinnerCount={bountyWinnerCount}
                bountyPrizeUsd={bountyPrizeUsd}
              />
            );
          })}
          {restRows.map((row, idx) => {
            const rank = bountyWinnerCount + idx + 1;
            const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
            return (
              <RankCard
                key={`${row.id}-${rank}`}
                row={row}
                rank={rank}
                isMe={isMe}
                tier="rest"
                bountyMode={mode}
                bountyWinnerCount={bountyWinnerCount}
                bountyPrizeUsd={bountyPrizeUsd}
              />
            );
          })}
          {ineligibleRows.map((row, idx) => {
            const rank = eligibleRows.length + idx + 1;
            const isMe = Boolean(row.username && myLeaderboardUsernames.has(row.username));
            return (
              <RankCard
                key={`${row.id}-${rank}`}
                row={row}
                rank={rank}
                isMe={isMe}
                tier="rest"
                bountyMode={mode}
                bountyWinnerCount={bountyWinnerCount}
                bountyPrizeUsd={bountyPrizeUsd}
              />
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#020a0b] text-white overflow-x-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={gridBgStyle} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#10343b_0%,#061416_45%,transparent_70%)]" />

      <main className="relative z-10 mx-auto max-w-md px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-cyan-300/80 hover:text-cyan-200 text-xs font-semibold font-orbitron mb-4 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center mb-5"
        >
          <h1
            className="text-2xl sm:text-3xl font-black font-orbitron uppercase tracking-wider mb-1.5"
            style={{ textShadow: '0 0 24px rgba(0, 240, 255, 0.45)' }}
          >
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
              🏆 Hall of Dominance
            </span>
          </h1>
          <p className="text-cyan-300/55 font-dmSans text-[10px] sm:text-xs tracking-widest uppercase">
            {chainParam}
          </p>
        </motion.div>

        <JulyBogoPromoBanner variant="compact" className="mb-4" />

        <ScopeTabs timeScope={timeScope} setTimeScope={setTimeScope} bountyMonthLabel={bountyMonthLabel} />

        {timeScope === 'month' && (
          <div className="flex justify-center mb-4">
            <label className="flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-[#0a1214]/90 px-3 py-2">
              <CalendarDays className="h-3.5 w-3.5 text-cyan-400/80" />
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="bg-transparent text-white text-xs font-medium focus:outline-none cursor-pointer pr-4"
              >
                {monthOptions.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#0a1214]">
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="mb-4 flex items-start gap-2 rounded-lg border border-cyan-500/15 bg-[#081517]/70 px-3 py-2.5 text-[11px] text-white/55 leading-snug">
          <Info className="w-3.5 h-3.5 text-cyan-400/70 shrink-0 mt-0.5" />
          <span>{infoLabel}</span>
        </div>

        {lastUpdatedLabel && (
          <p className="mb-4 text-center text-[10px] text-white/35 tracking-wide">
            Last updated {lastUpdatedLabel} · refreshes 12:00 AM UTC
          </p>
        )}

        <YourRankStrip
          myPosition={myPosition}
          myLeaderboardUsernames={myLeaderboardUsernames}
          loading={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/30 py-16">
            <Loader2 className="h-9 w-9 animate-spin text-cyan-300" />
            <p className="text-white/60 font-orbitron text-xs">Loading rankings…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-6 text-center">
            <p className="mb-3 text-sm text-red-200">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-full border border-cyan-400/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-black/30 py-14 text-white/55">
            <Users className="h-8 w-8 text-cyan-300/60" />
            <p className="text-sm">No entries yet for this scope.</p>
          </div>
        ) : bountyMode ? (
          renderList(true)
        ) : (
          renderList(false)
        )}
      </main>
    </div>
  );
}
