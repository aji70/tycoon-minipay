"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { ARENA_SPEND_COMING_SOON, ARENA_TOURNAMENTS_COMING_SOON } from "@/constants/arena";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage, useWriteContract, usePublicClient, useChainId } from "wagmi";
import { apiClient, ONCHAIN_BATCH_REQUEST_TIMEOUT_MS, ApiError } from "@/lib/api";
import { ArenaOnchainModal, type ArenaOnchainBusyPayload } from "@/components/arena/arena-onchain-modal";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress, isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { walletAuthParams } from "@/lib/walletSession";
import { createSignedArenaAgentLobby } from "@/lib/createSignedArenaAgentLobby";
import {
  canCreateWithoutGoodDollar,
  extractGoodDollarVerify,
  promptGoodDollarVerify,
} from "@/lib/goodDollarVerifyPrompt";
import { ApiResponse } from "@/types/api";
import styles from "./arena.module.css";
import { isAgentStyleTournament, tournamentDetailPath } from "@/lib/tournamentRoutes";
import { ArenaLeaderboardTab } from "@/components/arena/arena-leaderboard-tab";
import { ArenaMyAgentsSimple } from "@/components/arena/arena-my-agents-simple";
import { ArenaChallengesTab } from "@/components/arena/arena-challenges-tab";
import {
  ArenaRevampPage,
  type ArenaTab,
  type MatchType,
} from "@/components/arena/revamp/ArenaRevampPage";
import { resolveDiscoverAgents } from "@/components/arena/revamp/map-api-agents";
import { soloBoardPath } from "@/lib/boardRoutes";

/** localStorage key for the last agent the user picked as challenger. */
const LAST_AGENT_KEY = "tycoon-arena-last-agent-id";
/** Max time to show the auth skeleton before giving up and showing the UI. */
const AUTH_SKELETON_TIMEOUT_MS = 5000;

/** Multi-opponent batch games from Discover tab. */
const MAX_DISCOVER_OPPONENTS = 7;
/** Challenges tab (approved pool) is one opponent per game. */
const MAX_CHALLENGES_OPPONENTS = 1;

interface ArenaTournamentRow {
  id: number;
  code?: string | null;
  name: string;
  status: string;
  chain: string;
  entry_fee_wei: string | number;
  prize_source?: string;
  visibility?: string;
  is_agent_only?: boolean;
  participant_count?: number;
  max_players?: number;
}

function formatTournamentEntryFee(wei: string | number): string {
  const n = Number(wei);
  if (!Number.isFinite(n) || n === 0) return "Free";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)} USDC entry`;
  return `${n} (fee)`;
}

function tournamentHref(t: ArenaTournamentRow): string {
  return tournamentDetailPath({
    id: t.id,
    code: t.code ?? undefined,
    visibility: t.visibility as "OPEN" | "INVITE_ONLY" | "BOT_SELECTION" | undefined,
    is_agent_only: t.is_agent_only,
  });
}

interface Agent {
  id: number;
  name: string;
  username: string;
  elo_rating?: number;
  xp?: number;
  arena_wins: number;
  arena_losses: number;
  arena_draws: number;
  tier: string;
  tier_color: string;
  total_games: number;
  is_public?: boolean;
  status?: string;
  erc8004_agent_id?: string | null;
  max_entry_fee_usdc?: string | null;
  daily_cap_usdc?: string | null;
  chain?: string | null;
}

interface LeaderboardEntry extends Agent {
  rank: number;
}

/** Stored Elo baseline in DB; display XP is points above this. */
const ARENA_ELO_BASELINE = 1000;

function xpOf(a: Agent) {
  if (a.xp != null && Number.isFinite(Number(a.xp))) return Math.max(0, Number(a.xp));
  const raw = Number(a.elo_rating);
  if (Number.isFinite(raw)) return Math.max(0, raw - ARENA_ELO_BASELINE);
  return 0;
}

const TierColors: Record<string, string> = {
  gold: "#FFD700",
  cyan: "#00FFFF",
  purple: "#9370DB",
  yellow: "#FFFF00",
  silver: "#C0C0C0",
  brown: "#8B4513",
};

const TierLabels: Record<string, string> = {
  gold: "Legend",
  cyan: "Elite",
  purple: "Master",
  yellow: "Pro",
  silver: "Challenger",
  brown: "Rookie",
};

function tierLabelOf(a: Agent): string {
  const key = String(a.tier_color || "").toLowerCase();
  return TierLabels[key] || a.tier || "Tier";
}

/** Format USDC stored as integer string (6 decimals) for display. */
const ARENA_TABS: ArenaTab[] = ["discover", "my-agents", "challenges", "leaderboard", "tournaments"];

function formatUsdcDisplay(stored: string | null | undefined): string {
  if (stored == null || String(stored).trim() === "") return "—";
  try {
    const n = BigInt(String(stored));
    if (n === 0n) return "$0";
    const whole = n / 1_000_000n;
    const frac = n % 1_000_000n;
    const fracStr = frac === 0n ? "" : "." + frac.toString().padStart(6, "0").replace(/0+$/, "");
    return `$${whole}${fracStr}`;
  } catch {
    return "—";
  }
}

export default function ArenaPage() {
  const router = useRouter();
  const guestCtx = useGuestAuthOptional();
  const guestUser = guestCtx?.guestUser ?? null;
  const authLoadingRaw = guestCtx?.isLoading ?? false;
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const walletParams = useMemo(
    () =>
      walletAuthParams(
        getGuestUserPlayAddress(guestUser) ?? walletAddress ?? undefined,
        "CELO"
      ),
    [guestUser, walletAddress]
  );
  const canFetchMyAgents = Boolean(guestUser) || Boolean(walletParams?.address);
  /** Capped so the UI can't spin indefinitely if /auth/me stalls. */
  const [authSkeletonExpired, setAuthSkeletonExpired] = useState(false);
  const silentRetryRef = useRef(false);
  const launchLoginRef = useRef(false);
  useEffect(() => {
    if (!authLoadingRaw) return;
    const id = setTimeout(() => setAuthSkeletonExpired(true), AUTH_SKELETON_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [authLoadingRaw]);
  useEffect(() => {
    if (!authLoadingRaw) setAuthSkeletonExpired(false);
  }, [authLoadingRaw]);
  // Silent /auth/me retry after the skeleton timeout. Only once. Does NOT request a signature.
  useEffect(() => {
    if (!authSkeletonExpired || silentRetryRef.current) return;
    silentRetryRef.current = true;
    guestCtx?.refetchGuest?.();
  }, [authSkeletonExpired, guestCtx]);
  const authLoading = authLoadingRaw && !authSkeletonExpired;
  // isAuthed = backend session confirmed (guestUser) OR we can prompt a signature on launch (walletConnected).
  // We NEVER trigger a signature on page load — only on launch click (see ensureBackendSessionForLaunch).
  const isAuthed = Boolean(guestUser) || walletConnected;

  /**
   * Arena start-game needs a backend JWT (requireAuth). MiniPay has no signature-free login API —
   * JWT comes from localStorage `token` (prior loginByWallet / email) or a wallet signature via
   * POST /auth/login-by-wallet (same path as agents-page-mobile). Never prompt on page load.
   */
  const ensureBackendSessionForLaunch = useCallback(async (): Promise<boolean> => {
    if (guestUser) return true;

    // Token may exist while guestUser is still null — hydrate first (no signature).
    try {
      const token =
        typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem("token")
          : null;
      if (token?.trim() && guestCtx?.refetchGuest) {
        await guestCtx.refetchGuest();
        // guestUser in this closure is stale; re-check storage + /auth/me via refetch side effect.
        // Callers re-read guestCtx after await; also probe token success via a fresh /auth/me.
        const me = await apiClient.get<{ success?: boolean; data?: { id?: number } }>("auth/me");
        if (me?.data?.data?.id) return true;
      }
    } catch {
      /* fall through to wallet sign-in */
    }

    if (!walletConnected || !walletAddress) return false;
    if (!guestCtx?.loginByWallet || !signMessageAsync) return false;
    if (launchLoginRef.current) return false;
    launchLoginRef.current = true;
    try {
      const message = `Sign in to Tycoon at ${Date.now()}`;
      const chain = "CELO";
      const signature = await signMessageAsync({ message });
      const res = await guestCtx.loginByWallet({ address: walletAddress, chain, message, signature });
      if (res?.success) {
        await guestCtx.refetchGuest?.();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      launchLoginRef.current = false;
    }
  }, [guestUser, walletConnected, walletAddress, guestCtx, signMessageAsync]);
  const [activeTab, setActiveTab] = useState<ArenaTab>("discover");

  const setArenaTab = useCallback(
    (tab: ArenaTab) => {
      setActiveTab(tab);
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (tab === "discover") params.delete("tab");
      else params.set("tab", tab);
      const qs = params.toString();
      router.replace(qs ? `/arena?${qs}` : "/arena", { scroll: false });
    },
    [router]
  );
  /** Default: agents auto-play. "You vs Agent" is opt-in (you roll dice). */
  const [matchType, setMatchType] = useState<MatchType>("agentVsAgent");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);
  const [challengerAgentId, setChallengerAgentId] = useState<number | null>(null);
  const [stakeAmountUsdc, setStakeAmountUsdc] = useState("");
  const [arenaStarting, setArenaStarting] = useState(false);
  /** You play seat 1 vs one opponent agent (seat 2 auto-plays). */
  const [humanVsOpponentId, setHumanVsOpponentId] = useState<number | null>(null);
  const [humanVsStakeUsdc, setHumanVsStakeUsdc] = useState("");
  const [humanVsStarting, setHumanVsStarting] = useState(false);
  /** Sub-mode under Challenges tab */
  const [challengesSubTab, setChallengesSubTab] = useState<"agentVsAgent" | "youVsAgent">("agentVsAgent");
  const [arenaTxModalOpen, setArenaTxModalOpen] = useState(false);
  const [arenaTxBusy, setArenaTxBusy] = useState<ArenaOnchainBusyPayload | null>(null);
  const [openTournaments, setOpenTournaments] = useState<ArenaTournamentRow[]>([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);
  const [tournamentPerms, setTournamentPerms] = useState<Record<number, { enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }>>({});
  const [challengesLoading, setChallengesLoading] = useState(false);

  const stakeNumForSlots = stakeAmountUsdc.trim() ? parseFloat(stakeAmountUsdc) : 0;
  const stakedOneVOne =
    Number.isFinite(stakeNumForSlots) && stakeNumForSlots > 0;

  const maxOpponentPicks =
    activeTab === "discover"
      ? matchType === "agentVsAi" || stakedOneVOne
        ? 1
        : MAX_DISCOVER_OPPONENTS
      : MAX_CHALLENGES_OPPONENTS;

  useEffect(() => {
    setSelectedOpponents((prev) => (prev.length > maxOpponentPicks ? prev.slice(0, maxOpponentPicks) : prev));
  }, [maxOpponentPicks]);

  const mergeTournamentPermsFromApiResponse = useCallback((permsRes: unknown) => {
    const list =
      (permsRes as { data?: { data?: unknown } })?.data?.data ?? (permsRes as { data?: unknown })?.data ?? [];
    const arr = Array.isArray(list) ? list : [];
    const map: Record<number, { enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }> = {};
    for (const p of arr as Array<{ user_agent_id?: number; enabled?: boolean; max_entry_fee_usdc?: string; daily_cap_usdc?: string | null; chain?: string | null }>) {
      if (p?.user_agent_id != null) {
        map[Number(p.user_agent_id)] = {
          enabled: !!p.enabled,
          max_entry_fee_usdc: p.max_entry_fee_usdc ?? "0",
          daily_cap_usdc: p.daily_cap_usdc ?? null,
          chain: p.chain ?? null,
        };
      }
    }
    setTournamentPerms(map);
  }, []);

  const refreshArenaTournamentPerms = useCallback(async () => {
    try {
      const permsRes = await apiClient.get("/agents/tournament-permissions", walletParams ?? undefined);
      mergeTournamentPermsFromApiResponse(permsRes);
    } catch (e) {
      console.error("Refresh tournament permissions:", e);
    }
  }, [mergeTournamentPermsFromApiResponse, walletParams]);

  // Wallet address alone is enough (requireAuthOrWallet); JWT guest session optional.
  useEffect(() => {
    if (canFetchMyAgents) {
      fetchMyAgents();
    }
  }, [canFetchMyAgents, walletParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (!tab) return;
    const alias = tab === "play" ? "discover" : tab;
    if (ARENA_TABS.includes(alias as ArenaTab)) {
      setActiveTab(alias as ArenaTab);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "discover" && canFetchMyAgents) {
      fetchMyAgents();
    }
  }, [activeTab, canFetchMyAgents, walletParams]);

  useEffect(() => {
    if (ARENA_TOURNAMENTS_COMING_SOON) return;
    if (activeTab !== "tournaments") return;
    let cancelled = false;
    (async () => {
      setTournamentsLoading(true);
      setTournamentsError(null);
      try {
        const res = await apiClient.get<ArenaTournamentRow[] | { data?: ArenaTournamentRow[] }>("/tournaments", {
          status: "REGISTRATION_OPEN",
          limit: 20,
          offset: 0,
          tournament_kind: "agent",
        });
        const body = res?.data as unknown;
        const raw: ArenaTournamentRow[] = Array.isArray(body)
          ? body
          : body != null && typeof body === "object" && "data" in body && Array.isArray((body as { data: ArenaTournamentRow[] }).data)
            ? (body as { data: ArenaTournamentRow[] }).data
            : [];
        // Arena tab: bot/agent events only (never show human brackets, even if API omits tournament_kind).
        const list = raw.filter((t) =>
          isAgentStyleTournament({
            visibility: t.visibility as "OPEN" | "INVITE_ONLY" | "BOT_SELECTION" | undefined,
            is_agent_only: t.is_agent_only,
          })
        );
        if (!cancelled) setOpenTournaments(list);
      } catch (e) {
        if (!cancelled) {
          setTournamentsError((e as Error)?.message || "Failed to load tournaments");
          setOpenTournaments([]);
        }
      } finally {
        if (!cancelled) setTournamentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (myAgents.length === 0 || challengerAgentId != null) return;
    let preferred: number | null = null;
    try {
      const stored = window.localStorage.getItem(LAST_AGENT_KEY);
      if (stored) {
        const n = Number(stored);
        if (Number.isFinite(n) && myAgents.some((a) => a.id === n)) preferred = n;
      }
    } catch {
      /* ignore */
    }
    setChallengerAgentId(preferred ?? myAgents[0].id);
  }, [myAgents, challengerAgentId]);

  const handleChallengerChange = useCallback((id: number) => {
    setChallengerAgentId(id);
    try {
      window.localStorage.setItem(LAST_AGENT_KEY, String(id));
    } catch {
      /* ignore */
    }
  }, []);

  const handleReplaceOpponents = useCallback(
    (ids: number[]) => setSelectedOpponents(ids),
    []
  );

  const handleAgentCreated = useCallback(
    (agent: { id: number; name: string }) => {
      setChallengerAgentId(agent.id);
      try {
        window.localStorage.setItem(LAST_AGENT_KEY, String(agent.id));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const dismissError = useCallback(() => setError(null), []);

  const approvedAgentIds = Object.keys(tournamentPerms).map(Number).filter((id) => tournamentPerms[id]?.enabled);
  const approvedAgentsForChallenges = myAgents.filter((a) => approvedAgentIds.includes(a.id));
  useEffect(() => {
    if (ARENA_SPEND_COMING_SOON) return;
    if (activeTab === "challenges" && approvedAgentsForChallenges.length > 0) {
      const valid = approvedAgentsForChallenges.some((a) => a.id === challengerAgentId);
      if (!valid) setChallengerAgentId(approvedAgentsForChallenges[0].id);
    }
  }, [activeTab, approvedAgentsForChallenges, challengerAgentId]);

  useEffect(() => {
    if (activeTab === "discover") {
      fetchPublicAgents(page);
      return;
    }
    if (ARENA_SPEND_COMING_SOON) return;
    if (activeTab === "challenges") {
      fetchPublicAgents(page, { approvedToSpend: true });
    }
  }, [activeTab, page]);

  useEffect(() => {
    if (activeTab === "leaderboard") {
      fetchLeaderboard();
    }
  }, [activeTab]);

  useEffect(() => {
    if (ARENA_SPEND_COMING_SOON) return;
    if (activeTab !== "challenges" || !canFetchMyAgents) return;
    let cancelled = false;
    setChallengesLoading(true);
    (async () => {
      try {
        const [agentsRes, permsRes] = await Promise.all([
          apiClient.get<ApiResponse<Agent[]>>("/agents", walletParams ?? undefined),
          apiClient.get<{ success: boolean; data?: { data?: Array<{ user_agent_id: number; enabled: boolean; max_entry_fee_usdc: string; daily_cap_usdc: string | null; chain: string | null }> } }>(
            "/agents/tournament-permissions",
            walletParams ?? undefined
          ),
        ]);
        if (cancelled) return;
        if (agentsRes?.data?.success && agentsRes.data.data) setMyAgents(agentsRes.data.data);
        mergeTournamentPermsFromApiResponse(permsRes);
      } catch (e) {
        console.error("Challenges fetch:", e);
      } finally {
        if (!cancelled) setChallengesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, canFetchMyAgents, walletParams, mergeTournamentPermsFromApiResponse]);

  useEffect(() => {
    if (activeTab !== "discover" || !canFetchMyAgents) return;
    let cancelled = false;
    (async () => {
      try {
        const permsRes = await apiClient.get("/agents/tournament-permissions", walletParams ?? undefined);
        if (!cancelled) mergeTournamentPermsFromApiResponse(permsRes);
      } catch (e) {
        console.error("Discover tournament permissions:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, canFetchMyAgents, walletParams, mergeTournamentPermsFromApiResponse]);

  useEffect(() => {
    if (activeTab !== "my-agents" || !canFetchMyAgents) return;
    let cancelled = false;
    (async () => {
      try {
        const [agentsRes, permsRes] = await Promise.all([
          apiClient.get<ApiResponse<Agent[]>>("/agents", walletParams ?? undefined),
          apiClient.get("/agents/tournament-permissions", walletParams ?? undefined),
        ]);
        if (cancelled) return;
        if (agentsRes?.data?.success && agentsRes.data.data) {
          setMyAgents(agentsRes.data.data);
        }
        mergeTournamentPermsFromApiResponse(permsRes);
      } catch (e) {
        console.error("Refresh my agents (overview):", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, canFetchMyAgents, walletParams, mergeTournamentPermsFromApiResponse]);

  const fetchPublicAgents = async (pageNum: number, opts?: { approvedToSpend?: boolean }) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(pageNum), page_size: "20" });
      if (opts?.approvedToSpend) params.set("approved_to_spend", "1");
      const res = await apiClient.get<any>(`/arena/agents?${params.toString()}`);
      if (res?.data?.agents) {
        setAgents(res.data.agents);
      } else {
        throw new Error("Failed to fetch agents");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch agents: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<any>(`/arena/leaderboard?limit=50`);
      if (res?.data?.leaderboard) {
        setLeaderboard(res.data.leaderboard);
      } else {
        throw new Error("Failed to fetch leaderboard");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch leaderboard: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAgents = async (options?: { silent?: boolean }) => {
    const silent = !!options?.silent;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const res = await apiClient.get<ApiResponse<Agent[]>>("/agents", walletParams ?? undefined);
      if (res?.data?.success && res.data.data) {
        setMyAgents(res.data.data);
      } else {
        throw new Error("Failed to fetch agents");
      }
    } catch (err) {
      console.error("Fetch error:", err);
      if (!silent) {
        setError(`Failed to fetch your agents: ${(err as Error).message}`);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const toggleAgentPublic = async (agentId: number, currentValue: boolean) => {
    try {
      const res = await apiClient.patch<any>(`/agents/${agentId}`, {
        is_public: !currentValue,
        ...(walletParams ?? {}),
      });
      if (res?.success && res?.data?.data) {
        const updatedAgent = res.data.data;
        setMyAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, is_public: updatedAgent.is_public } : a))
        );
      } else {
        throw new Error("Failed to update agent");
      }
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const toggleOpponentSelect = (agentId: number) => {
    setSelectedOpponents((prev) => {
      if (prev.includes(agentId)) return prev.filter((id) => id !== agentId);
      // Single-select (You vs Agent or staked 1v1): replace the previous pick.
      if (maxOpponentPicks === 1) return [agentId];
      if (prev.length >= maxOpponentPicks) return prev;
      return [...prev, agentId];
    });
  };

  /**
   * Same G$ Identity pre-check as Challenge AI — block Arena before the user spends CELO on createGame.
   * Returns false if the Verify modal was shown (caller should abort).
   */
  const ensureGoodDollarVerifiedForArena = useCallback(async (): Promise<boolean> => {
    const playAddr =
      getGuestUserPlayAddress(guestUser) ?? walletAddress ?? walletParams?.address ?? undefined;
    if (!playAddr) return true; // no wallet yet — later steps will fail with a clearer error
    try {
      const gdRes = await apiClient.get<{
        enabled?: boolean;
        verified?: boolean;
        play_gate_exempt?: boolean;
        verifyUrl?: string;
        message?: string;
      }>("gooddollar/status", walletAuthParams(playAddr, "CELO"));
      const gd = (
        gdRes as {
          data?: {
            enabled?: boolean;
            verified?: boolean;
            play_gate_exempt?: boolean;
            verifyUrl?: string;
            message?: string;
          };
        }
      )?.data;
      if (!canCreateWithoutGoodDollar(gd)) {
        promptGoodDollarVerify({
          verifyUrl: gd?.verifyUrl || "https://goodid.gooddollar.org/",
          message: gd?.message || "Verify your humanity with GoodDollar to play.",
        });
        return false;
      }
      return true;
    } catch (gdErr: unknown) {
      if (extractGoodDollarVerify(gdErr)) return false;
      // Status unreachable — backend still enforces on /arena/start-*.
      return true;
    }
  }, [guestUser, walletAddress, walletParams?.address]);

  const startArenaGame = async (opponentIds?: number[]) => {
    const opponents = opponentIds ?? selectedOpponents;
    if (!isAuthed || !challengerAgentId || opponents.length === 0) return;
    setError(null);
    setArenaStarting(true);
    try {
      // Gate before opening the tx modal / spending gas (same as Challenge AI).
      if (!(await ensureGoodDollarVerifiedForArena())) {
        return;
      }

      setArenaTxModalOpen(true);
      setArenaTxBusy(null);

      // You pay CELO for createGame; server only joins opponent agents (saves controller gas).
      const username = (guestUser?.username || "").trim();
      if (!username) {
        throw new Error("Sign in / register a username on Home before starting Agent Arena");
      }
      if (!publicClient || !writeContractAsync) {
        throw new Error("Wallet not ready — connect MiniPay and try again");
      }
      const seats = 1 + opponents.length;
      const { code: onChainCode, contractGameId } = await createSignedArenaAgentLobby({
        username,
        chainId: chainId || 42220,
        numberOfPlayers: seats,
        publicClient,
        writeContractAsync: writeContractAsync as never,
      });

      const res = await apiClient.post<any>(
        "/arena/start-game",
        {
          challenger_agent_id: challengerAgentId,
          opponent_agent_ids: opponents,
          arena_tab: activeTab,
          chain: "CELO",
          code: onChainCode,
          contract_game_id: contractGameId,
          is_minipay: true,
        },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      const code = (res?.data?.game_code as string | undefined) || onChainCode;
      if (code) {
        setArenaTxModalOpen(false);
        setSelectedOpponents([]);
        router.push(soloBoardPath(code));
      } else {
        throw new Error("No game code returned");
      }
    } catch (err) {
      const e = err as ApiError;
      // apiClient interceptor already popped the GoodDollar Verify modal.
      if (extractGoodDollarVerify(err)) {
        setArenaTxModalOpen(false);
        return;
      }
      if (e.status === 409 && e.data?.code === "AGENT_BUSY_IN_ARENA") {
        setArenaTxBusy({ message: e.message });
      } else {
        setArenaTxModalOpen(false);
        setError(e?.message || (err as Error).message || "Could not start match. Try again.");
      }
    } finally {
      setArenaStarting(false);
    }
  };

  const startHumanVsAgentGame = async (opponentId?: number) => {
    const oppId = opponentId ?? humanVsOpponentId;
    if (!isAuthed || !oppId) return;
    setError(null);
    setHumanVsStarting(true);
    try {
      if (!(await ensureGoodDollarVerifiedForArena())) {
        return;
      }

      setArenaTxModalOpen(true);
      setArenaTxBusy(null);

      // You pay CELO for createGame; server only joins the opponent agent (no controller create).
      const username = (guestUser?.username || "").trim();
      if (!username) {
        throw new Error("Sign in / register a username on Home before starting You vs Agent");
      }
      if (!publicClient || !writeContractAsync) {
        throw new Error("Wallet not ready — connect MiniPay and try again");
      }
      const { code: onChainCode, contractGameId } = await createSignedArenaAgentLobby({
        username,
        chainId: chainId || 42220,
        numberOfPlayers: 2,
        publicClient,
        writeContractAsync: writeContractAsync as never,
      });

      const res = await apiClient.post<any>(
        "/arena/start-human-vs-agent",
        {
          opponent_agent_id: oppId,
          chain: "CELO",
          code: onChainCode,
          contract_game_id: contractGameId,
          is_minipay: true,
        },
        { timeout: ONCHAIN_BATCH_REQUEST_TIMEOUT_MS }
      );
      const code = (res?.data?.game_code as string | undefined) || onChainCode;
      if (code) {
        setArenaTxModalOpen(false);
        setHumanVsOpponentId(null);
        setHumanVsStakeUsdc("");
        router.push(soloBoardPath(code));
      } else {
        throw new Error("No game code returned");
      }
    } catch (err) {
      const e = err as ApiError;
      if (extractGoodDollarVerify(err)) {
        setArenaTxModalOpen(false);
        return;
      }
      if (e.status === 409 && e.data?.code === "AGENT_BUSY_IN_ARENA") {
        setArenaTxBusy({ message: e.message });
      } else {
        setArenaTxModalOpen(false);
        setError(e?.message || (err as Error).message || "Could not start match. Try again.");
      }
    } finally {
      setHumanVsStarting(false);
    }
  };

  const discoverList = agents.filter((agent) => !myAgents.some((m) => m.id === agent.id));
  const discoverAgents = resolveDiscoverAgents(
    discoverList,
    myAgents.map((m) => m.id)
  );

  const handleRevampLaunch = async () => {
    if (matchType === "agentVsAi" && selectedOpponents.length !== 1) {
      setError("You vs Agent mode needs exactly one opponent.");
      return;
    }
    // Staked matches (stake > 0) are 1v1 only — backend rejects multi-opponent staked matches.
    const stakeNumForGuard = stakeAmountUsdc.trim() ? parseFloat(stakeAmountUsdc) : 0;
    if (
      matchType === "agentVsAgent" &&
      Number.isFinite(stakeNumForGuard) &&
      stakeNumForGuard > 0 &&
      selectedOpponents.length !== 1
    ) {
      setError("Staked matches are 1-vs-1. Pick exactly one opponent or set stake to Free.");
      return;
    }
    // If backend session is missing, hydrate JWT or prompt signature on launch (not on page load).
    if (!guestUser) {
      const ok = await ensureBackendSessionForLaunch();
      if (!ok) {
        const inMiniPay = isMiniPayEmbeddedWallet();
        setError(
          !walletConnected
            ? "Connect your wallet, then try again."
            : inMiniPay
              ? "Couldn't sign you in. Go Home, finish Connect / Register, then return to Arena."
              : "Couldn't sign you in. Approve the wallet signature, or register on Home first."
        );
        return;
      }
    }
    if (matchType === "agentVsAi") {
      void startHumanVsAgentGame(selectedOpponents[0]);
    } else {
      void startArenaGame();
    }
  };

  const tabPanels: Partial<Record<ArenaTab, React.ReactNode>> = {
    challenges: ARENA_SPEND_COMING_SOON ? (
      <section className={styles.tournamentPanel} aria-label="Spend coming soon">
        <h2>Spend</h2>
        <p className={styles.comingSoonBadge}>Coming soon</p>
        <p className={styles.tournamentExplainer}>
          Let agents spend <strong>USDC</strong> and <strong>G$</strong> on your behalf for staked arena
          matches. This advanced flow is not open yet — use Play for free agent battles.
        </p>
      </section>
    ) : (
      <ArenaChallengesTab
        agents={discoverList}
        myAgents={myAgents}
        tournamentPerms={tournamentPerms}
        subMode={challengesSubTab}
        onSubModeChange={setChallengesSubTab}
        challengerAgentId={challengerAgentId}
        onChangeChallengerAgent={setChallengerAgentId}
        selectedOpponent={humanVsOpponentId}
        onSelectOpponent={(id) => setHumanVsOpponentId((curr) => (curr === id ? null : id))}
        stakeAmount={challengesSubTab === "agentVsAgent" ? stakeAmountUsdc : humanVsStakeUsdc}
        onStakeChange={challengesSubTab === "agentVsAgent" ? setStakeAmountUsdc : setHumanVsStakeUsdc}
        onDeploy={challengesSubTab === "agentVsAgent" ? () => startArenaGame() : () => startHumanVsAgentGame()}
        isDeploying={challengesSubTab === "agentVsAgent" ? arenaStarting : humanVsStarting}
      />
    ),
    leaderboard: (
      <ArenaLeaderboardTab
        leaderboard={leaderboard}
        loading={loading}
        myAgentId={challengerAgentId ?? undefined}
      />
    ),
    tournaments: (
      <section className={styles.tournamentPanel} aria-label="Agent tournaments">
        <h2>Tournaments</h2>
        {ARENA_TOURNAMENTS_COMING_SOON ? (
          <>
            <p className={styles.comingSoonBadge}>Coming soon</p>
            <p className={styles.tournamentExplainer}>
              Agent bracket tournaments with <strong>USDC</strong> and <strong>G$</strong> entry and escrow
              prizes are not open yet on Celo.
            </p>
          </>
        ) : (
          <>
            <p className={styles.tournamentExplainer}>
              Agent tournaments on Celo — USDC and G$ entry with escrow-backed prizes.
            </p>
            <div className={styles.tournamentActions}>
              <Link href="/agent-tournaments" className={styles.tournamentLinkBtn}>
                All agent tournaments
              </Link>
              <Link href="/agent-tournaments/create?from=arena" className={styles.tournamentLinkBtn}>
                Create agent tournament
              </Link>
            </div>
            {tournamentsLoading ? (
              <p className={styles.tournamentEmpty}>Loading…</p>
            ) : tournamentsError ? (
              <p className={styles.error}>{tournamentsError}</p>
            ) : (
              <ul className={styles.tournamentList}>
                {openTournaments.map((t) => (
                  <li key={t.id} className={styles.tournamentRow}>
                    <div className={styles.tournamentRowMain}>
                      <p className={styles.tournamentRowTitle}>{t.name}</p>
                      <p className={styles.tournamentRowMeta}>
                        {t.chain} · {formatTournamentEntryFee(t.entry_fee_wei)}
                      </p>
                    </div>
                    <Link href={tournamentHref(t)} className={styles.tournamentRowCta}>
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    ),
    "my-agents": (
      <ArenaMyAgentsSimple
        isAuthed={isAuthed}
        myAgents={myAgents}
        onRefresh={() => fetchMyAgents({ silent: true })}
        onGoPlay={() => setArenaTab("discover")}
        onTogglePublic={toggleAgentPublic}
        playerUsername={guestUser?.username ?? null}
      />
    ),
  };

  return (
    <>
      <ArenaRevampPage
        activeTab={activeTab}
        onTabChange={setArenaTab}
        isAuthed={isAuthed}
        authLoading={authLoading}
        myAgents={myAgents}
        discoverAgents={discoverAgents}
        selectedOpponentIds={selectedOpponents}
        onToggleOpponent={toggleOpponentSelect}
        onReplaceOpponents={handleReplaceOpponents}
        maxOpponentSlots={maxOpponentPicks}
        stakedOneVOne={stakedOneVOne}
        challengerAgentId={challengerAgentId}
        onChallengerChange={handleChallengerChange}
        stakeAmount={stakeAmountUsdc}
        onStakeChange={setStakeAmountUsdc}
        matchType={matchType}
        onMatchTypeChange={setMatchType}
        onLaunch={handleRevampLaunch}
        isLaunching={arenaStarting || humanVsStarting}
        loading={loading && (activeTab === "discover" || activeTab === "challenges")}
        tabPanels={tabPanels}
        error={error}
        onDismissError={dismissError}
        onAgentCreated={handleAgentCreated}
        onRefreshMyAgents={() => fetchMyAgents({ silent: true })}
        playerUsername={guestUser?.username ?? null}
      />
      <ArenaOnchainModal
        open={arenaTxModalOpen}
        busy={arenaTxBusy}
        isMobile={false}
        onClose={() => {
          setArenaTxModalOpen(false);
          setArenaTxBusy(null);
        }}
      />
    </>
  );
}
