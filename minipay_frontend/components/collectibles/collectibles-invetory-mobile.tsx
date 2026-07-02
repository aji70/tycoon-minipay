'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useAccount,
  useChainId,
  useReadContracts,
} from "wagmi";
import { type Address, type Abi } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Image from "next/image";

import {
  Zap,
  Crown,
  Coins,
  Sparkles,
  Gem,
  Shield,
  ShoppingBag,
  Loader2,
  Flame,
  Percent,
  CircleDollarSign,
  MapPin,
  Clock,
} from "lucide-react";
import RewardABI from "@/context/abi/rewardabi.json";
import { REWARD_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { Game, GameProperty } from "@/types/game";
import { useRewardBurnCollectible } from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { refreshGameStateAfterPerk } from "@/lib/perks/refreshGameStateAfterPerk";
import {
  getPerkActivationError,
  getPerkApiMessage,
  getPerkFailureFallback,
  getPerkPreBurnBlockMessage,
  perkApiSucceeded,
} from "@/lib/perks/perkActivationErrors";
import { PERK_DISCOUNT_TIERS, PERK_REFUND_TIERS } from "@/lib/perks/perkTiers";
import { ApiResponse } from "@/types/api";
import { JAIL_POSITION } from "@/utils/constants/monopoly";
import {
  balancesFromReadResults,
  buildBalanceOfCallsForHeldTokens,
  buildMergedHolderSlotCalls,
  collectRewardHolderAddresses,
  mergeSlotScanResultsForHolders,
  REWARD_OWNED_SLOT_SCAN_CAP,
  sumBalances,
  uniqueHeldTokensFromSlotScan,
} from "@/lib/rewardOwnedEnumerable";
import { getPerkShopAsset } from "@/lib/perkShopAssets";
import { getInstantCashAmount, instantCashShopName } from "@/lib/perks/instantCash";

/** Full-viewport overlays must portal out of board modals (transform/overflow break `position: fixed` on many mobile WebViews). */
function getOverlayPortalTarget(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (document.fullscreenElement as HTMLElement | null) ?? document.body;
}

const COLLECTIBLE_ID_START = 2_000_000_000;

const BOARD_POSITIONS = [
  "GO", "Axone Avenue", "Community Chest", "Onlydust Avenue", "Income Tax",
  "IPFS Railroad", "ZK-Sync Lane", "Chance", "Starknet Lane", "Linea Lane",
  "Jail / Just Visiting", "Arbitrum Avenue", "Chainlink Electric Company", "Optimistic Avenue", "Base Avenue",
  "Pinata Railroad", "Near Lane", "Community Chest", "Cosmos Lane", "Polkadot Lane",
  "Free Parking", "Dune Lane", "Chance", "Uniswap Avenue", "MakerDAO Avenue",
  "O. Zeppelin Railroad", "AAVE Avenue", "Lisk Lane", "Graphic Water Works", "Rootstock Lane",
  "Go To Jail", "The Buidl Hub", "Ark Lane", "Community Chest", "Avalanche Avenue",
  "Cartridge Railroad", "Chance", "Solana Avenue", "Luxury Tax", "Ethereum Avenue"
];

const perkMetadata: Record<number, {
  name: string;
  icon: React.ReactNode;
  gradient: string;
  canBeActivated: boolean;
  fakeDescription?: string;
}> = {
  1: { name: "Extra Turn", icon: <Zap className="w-10 h-10" />, gradient: "from-yellow-500 to-amber-600", canBeActivated: true, fakeDescription: "Use on your turn to take an extra roll after this one." },
  2: { name: "Jail Free Card", icon: <Crown className="w-10 h-10" />, gradient: "from-purple-600 to-pink-600", canBeActivated: true, fakeDescription: "Use when in Jail to get out without paying or rolling doubles." },
  3: { name: "Double Rent", icon: <Coins className="w-10 h-10" />, gradient: "from-green-600 to-emerald-600", canBeActivated: true, fakeDescription: "When someone lands on your property, charge double the normal rent once." },
  4: { name: "Roll Boost", icon: <Sparkles className="w-10 h-10" />, gradient: "from-blue-600 to-cyan-600", canBeActivated: true, fakeDescription: "Add +1 to your next dice roll (capped at 12)." },
  5: { name: "Instant Cash", icon: <Gem className="w-10 h-10" />, gradient: "from-cyan-600 to-teal-600", canBeActivated: true, fakeDescription: "Use on your turn to add cash to your balance. Amount depends on tier ($100–$1,000)." },
  6: { name: "Teleport", icon: <Zap className="w-10 h-10" />, gradient: "from-pink-600 to-rose-600", canBeActivated: true, fakeDescription: "Move your token to any property on the board." },
  7: { name: "Shield", icon: <Shield className="w-10 h-10" />, gradient: "from-indigo-600 to-blue-600", canBeActivated: true, fakeDescription: "Block the next rent or fee you would pay (one use)." },
  8: { name: "Property Discount", icon: <Coins className="w-10 h-10" />, gradient: "from-orange-600 to-red-600", canBeActivated: true, fakeDescription: "Get 30–50% off the next property you buy (tiered)." },
  9: { name: "Tax Refund", icon: <Gem className="w-10 h-10" />, gradient: "from-teal-600 to-cyan-600", canBeActivated: true, fakeDescription: "Get in-game cash back when you pay Income or Luxury Tax (tiered)." },
  10: { name: "Exact Roll", icon: <Sparkles className="w-10 h-10" />, gradient: "from-amber-600 to-yellow-500", canBeActivated: true, fakeDescription: "Choose your next roll (2–12) instead of rolling the dice." },
  11: { name: "Rent Cashback", icon: <Percent className="w-10 h-10" />, gradient: "from-emerald-600 to-green-600", canBeActivated: true, fakeDescription: "Next rent you receive is +25% extra." },
  12: { name: "Interest", icon: <CircleDollarSign className="w-10 h-10" />, gradient: "from-lime-600 to-green-600", canBeActivated: true, fakeDescription: "At the start of your next turn, receive $200." },
  13: { name: "Lucky 7", icon: <Sparkles className="w-10 h-10" />, gradient: "from-yellow-500 to-amber-500", canBeActivated: true, fakeDescription: "Your next roll will be 7." },
  14: { name: "Free Parking Bonus", icon: <MapPin className="w-10 h-10" />, gradient: "from-sky-600 to-blue-600", canBeActivated: true, fakeDescription: "Land on Free Parking to collect $500." },
};

interface CollectibleInventoryBarProps {
  game: Game;
  game_properties: GameProperty[];
  isMyTurn: boolean;
  ROLL_DICE: () => void;
  END_TURN?: () => void;
  triggerSpecialLanding?: (position: number, isSpecial: boolean) => void;
  endTurnAfterSpecial?: () => void;
  userAddress?: string | null;
  userWalletAddresses?: string[];
  /** Refetch game state after a perk successfully updates the server (balance, perks, jail, etc.). */
  onPerkApplied?: () => void | Promise<void>;
  /** Board chip bar path: simple confirm + burn on the board page (same as PerksBar). */
  onUsePerk?: (tokenId: bigint, perk: number, strength: number, name: string) => void;
  /** When set, used for Extra Turn and other roll-gated perks in the My Perks sheet. */
  playerCanRoll?: boolean;
}

export default function CollectibleInventoryBar({
  game,
  game_properties,
  isMyTurn,
  ROLL_DICE,
  triggerSpecialLanding,
  userAddress,
  userWalletAddresses,
  onPerkApplied,
  onUsePerk,
  playerCanRoll,
}: CollectibleInventoryBarProps) {
  const { address: wagmiAddress, isConnected } = useAccount();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chainId = useChainId();
  const contractAddress = REWARD_CONTRACT_ADDRESSES[chainId as keyof typeof REWARD_CONTRACT_ADDRESSES] as Address | undefined;

  const perkShopHref = useMemo(() => {
    const path = pathname ?? "";
    const qs = searchParams?.toString();
    const returnTo = path + (qs ? `?${qs}` : "");
    return `/game-shop?returnTo=${encodeURIComponent(returnTo)}`;
  }, [pathname, searchParams]);

  // Use provided wallet addresses, or fall back to single userAddress, or wagmi address
  const addressesToCheck = useMemo(
    () => collectRewardHolderAddresses(...(userWalletAddresses ?? []), userAddress, wagmiAddress),
    [userWalletAddresses, userAddress, wagmiAddress]
  );
  const address = addressesToCheck[0] as Address | undefined;

  const [overlayPortalTarget, setOverlayPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setOverlayPortalTarget(getOverlayPortalTarget());
    const onFullscreenChange = () => setOverlayPortalTarget(getOverlayPortalTarget());
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const [pendingPerk, setPendingPerk] = useState<{
    tokenId: bigint;
    perkId: number;
    name: string;
    strength?: number;

  } | null>(null);

  const [selectedPositionIndex, setSelectedPositionIndex] = useState<number | null>(null);
  const [selectedRollTotal, setSelectedRollTotal] = useState<number | null>(null);

  const { burn: burnCollectible, isPending: isBurning, isSuccess: burnSuccess, reset: resetBurn } = useRewardBurnCollectible();
  const burnConfirmedRef = useRef(false);

  const currentPlayer = useMemo(() => {
    if (!address || !game?.players) return null;
    return game.players.find(p => p.address?.toLowerCase() === address.toLowerCase()) || null;
  }, [address, game?.players]);

  const playerInJail = !!(
    currentPlayer?.in_jail && Number(currentPlayer?.position) === JAIL_POSITION
  );

  const getRealPlayerId = (walletAddress: string | undefined): number | null => {
    if (!walletAddress) return null;
    const owned = game_properties.find(gp => gp.address?.toLowerCase() === walletAddress.toLowerCase());
    return owned?.player_id ?? null;
  };

  const applyCashAdjustment = async (playerId: number, amount: number): Promise<boolean> => {
    if (amount === 0) return true;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) {
      toast.error("Must own a property");
      return false;
    }
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: targetPlayer.user_id,
        balance: (targetPlayer.balance ?? 0) + amount,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Cash adjustment failed");
      return false;
    }
  };

  const applyPositionChange = async (playerId: number, newPos: number): Promise<boolean> => {
    if (newPos < 0 || newPos > 39) return false;
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        position: newPos,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Position change failed");
      return false;
    }
  };

  const escapeJail = async (playerId: number): Promise<boolean> => {
    const targetPlayer = game.players.find(p => p.user_id === playerId);
    if (!targetPlayer?.address) return false;
    const realPlayerId = getRealPlayerId(targetPlayer.address);
    if (!realPlayerId) return false;
    try {
      const res = await apiClient.put<ApiResponse>(`/game-players/${realPlayerId}`, {
        game_id: game.id,
        user_id: playerId,
        in_jail: false,
      });
      return res?.success ?? false;
    } catch {
      toast.error("Failed to escape jail");
      return false;
    }
  };

  // === OWNED COLLECTIBLES === (slot-scan + balanceOf: see rewardOwnedEnumerable.ts)
  const validAddresses = addressesToCheck;

  const ownedTokenCalls = useMemo(() => {
    if (!contractAddress || validAddresses.length === 0) return [];
    return buildMergedHolderSlotCalls(contractAddress, RewardABI as Abi, validAddresses, chainId, REWARD_OWNED_SLOT_SCAN_CAP);
  }, [contractAddress, validAddresses, chainId]);

  const { data: tokenResults } = useReadContracts({
    contracts: ownedTokenCalls,
    query: { enabled: !!contractAddress && validAddresses.length > 0 },
  });

  const { tokenIds: ownedTokenIds, heldBy: ownedHeldBy } = useMemo(
    () => mergeSlotScanResultsForHolders(validAddresses, tokenResults, REWARD_OWNED_SLOT_SCAN_CAP),
    [validAddresses, tokenResults]
  );

  const heldTokens = useMemo(
    () => uniqueHeldTokensFromSlotScan(ownedTokenIds, ownedHeldBy),
    [ownedTokenIds, ownedHeldBy]
  );

  const collectibleHeldTokens = useMemo(
    () => heldTokens.filter((t) => t.tokenId >= BigInt(COLLECTIBLE_ID_START)),
    [heldTokens]
  );

  const balanceCalls = useMemo(() => {
    if (!contractAddress || collectibleHeldTokens.length === 0) return [];
    return buildBalanceOfCallsForHeldTokens(contractAddress, RewardABI as Abi, collectibleHeldTokens, chainId);
  }, [contractAddress, collectibleHeldTokens, chainId]);

  const { data: balanceResults } = useReadContracts({
    contracts: balanceCalls,
    query: { enabled: !!contractAddress && collectibleHeldTokens.length > 0 },
  });

  const collectibleBalances = useMemo(() => {
    const balances = balancesFromReadResults(balanceResults);
    return collectibleHeldTokens
      .map((t, i) => ({ ...t, balance: balances[i] ?? 0 }))
      .filter((t) => t.balance > 0);
  }, [collectibleHeldTokens, balanceResults]);

  const infoCalls = useMemo(
    () =>
      collectibleBalances.map((t) => ({
        address: contractAddress!,
        abi: RewardABI as Abi,
        functionName: "getCollectibleInfo" as const,
        args: [t.tokenId],
      })),
    [contractAddress, collectibleBalances]
  );

  const { data: infoResults } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: collectibleBalances.length > 0 },
  });

  const ownedCollectiblesRaw = useMemo(() => {
    if (!infoResults) return [];

    return infoResults
      .map((res, i) => {
        if (res?.status !== "success") return null;
        const { tokenId, holder, balance } = collectibleBalances[i]!;
        const [perkBig, strengthBig] = res.result as [bigint, bigint];
        const perk = Number(perkBig);
        const strength = Number(strengthBig);
        const meta = perkMetadata[perk] ?? perkMetadata[10];

        const displayName = perk === 5
          ? instantCashShopName(strength)
          : (perk === 8 || perk === 9)
            ? `${meta.name} (Tier ${strength})`
            : meta.name;

        const shopAsset = getPerkShopAsset(perk);

        return {
          tokenId,
          holder,
          balance,
          perk,
          name: displayName,
          icon: meta.icon,
          gradient: meta.gradient,
          canBeActivated: meta.canBeActivated,
          fakeDescription: meta.fakeDescription,
          strength,
          shopImage: shopAsset?.image,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [infoResults, collectibleBalances]);

  // Group by (perk, strength) so we can show one card per type with "×n" when count > 1
  const ownedCollectibles = useMemo(() => {
    const byKey = new Map<string, { item: typeof ownedCollectiblesRaw[0]; tokenIds: bigint[]; count: number }>();
    for (const item of ownedCollectiblesRaw) {
      const key = `${item.perk}-${item.strength}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.tokenIds.push(item.tokenId);
        existing.count += item.balance;
      } else {
        byKey.set(key, { item, tokenIds: [item.tokenId], count: item.balance });
      }
    }
    return Array.from(byKey.values()).map(({ item, tokenIds, count }) => ({
      ...item,
      tokenId: tokenIds[0],
      count,
    }));
  }, [ownedCollectiblesRaw]);

  const totalOwned = useMemo(
    () => sumBalances(ownedCollectiblesRaw.map((item) => item.balance)),
    [ownedCollectiblesRaw]
  );

  const handleUsePerk = (
    tokenId: bigint,
    perkId: number,
    name: string,
    canBeActivated: boolean,
    strength: number = 1
  ) => {
    if (!isMyTurn) {
      toast("Wait for your turn!", { icon: "⏳" });
      return;
    }

    if (!currentPlayer) {
      toast.error("Player data not found");
      return;
    }

    if (!canBeActivated) {
      toast(`${name} — ${perkMetadata[perkId]?.fakeDescription || "Use during a game for its effect."}`, {
        icon: <Clock className="w-5 h-5" />,
        duration: 5000
      });
      return;
    }

    const blockMsg = getPerkPreBurnBlockMessage({
      perkId,
      isMyTurn,
      playerCanRoll,
      inJail: playerInJail,
      rolls: currentPlayer?.rolls,
    });
    if (blockMsg) {
      toast.error(blockMsg);
      return;
    }

    if (isBurning) {
      toast("Wait for your perk to finish...", { icon: "⏳" });
      return;
    }

    // Match PerksBar chips: board-level "Use perk?" for most perks; picker sheet only for Teleport / Exact Roll.
    if (onUsePerk && perkId !== 6 && perkId !== 10) {
      onUsePerk(tokenId, perkId, strength, name);
      return;
    }

    burnConfirmedRef.current = false;
    resetBurn();
    setPendingPerk({ tokenId, perkId, name, strength });
  };

  useEffect(() => {
    if (!pendingPerk || !burnSuccess || !burnConfirmedRef.current || !currentPlayer) return;

    const { perkId, name, strength = 1 } = pendingPerk;

    const toastId = toast.loading("Applying perk effect...");

    (async () => {
      try {
        let success = false;
        let failureMessage: string | null = null;

        switch (perkId) {
          case 1: {
            const res = await apiClient.post<{ success?: boolean; message?: string }>("/perks/use-extra-turn", {
              game_id: game.id,
              from_collectible: true,
            });
            success = perkApiSucceeded(res);
            if (success) {
              toast.success("Extra Turn activated! Roll again!", { id: toastId });
              await refreshGameStateAfterPerk(onPerkApplied);
              setTimeout(() => ROLL_DICE(), 800);
            } else {
              failureMessage = getPerkApiMessage(res, getPerkFailureFallback(1));
            }
            break;
          }
          case 2: {
            const res = await apiClient.post<{ success?: boolean; message?: string }>("/perks/use-jail-free", {
              game_id: game.id,
              from_collectible: true,
            });
            success = perkApiSucceeded(res);
            if (success) {
              toast.success("Escaped jail! 🚔➡️🛤️", { id: toastId });
            } else {
              failureMessage = getPerkApiMessage(res, getPerkFailureFallback(2));
            }
            break;
          }
          case 5: {
            const amount = getInstantCashAmount(strength);
            const res = await apiClient.post<{ success?: boolean; reward?: number; message?: string }>("/perks/burn-cash", {
              game_id: game.id,
              from_collectible: true,
              amount,
            });
            success = perkApiSucceeded(res);
            const reward = res?.data?.reward ?? amount;
            if (success) {
              toast.success(`+$${reward} Instant Cash!`, { id: toastId });
            } else {
              failureMessage = getPerkApiMessage(res, getPerkFailureFallback(5));
            }
            break;
          }
          case 3:
          case 4:
          case 7:
          case 11:
          case 12:
          case 13:
          case 14: {
            const res = await apiClient.post<{ success?: boolean; message?: string }>("/perks/activate", {
              game_id: game.id,
              perk_id: perkId,
            });
            success = perkApiSucceeded(res);
            if (success) {
              toast.success(perkId === 13 ? "Lucky 7! Next roll will be 7." : `${name} activated!`, { id: toastId });
            } else {
              failureMessage = getPerkApiMessage(res, getPerkFailureFallback(perkId));
            }
            break;
          }
          case 8: {
            const discount = PERK_DISCOUNT_TIERS[Math.min(strength, PERK_DISCOUNT_TIERS.length - 1)];
            if (discount > 0) {
              const res = await apiClient.post<{ success?: boolean; message?: string }>("/perks/apply-cash", {
                game_id: game.id,
                perk_id: 8,
                amount: discount,
                from_collectible: true,
              });
              success = perkApiSucceeded(res);
              if (success) {
                toast.success(`+$${discount} Property Discount!`, { id: toastId });
              } else {
                failureMessage = getPerkApiMessage(res, getPerkFailureFallback(8));
              }
            }
            break;
          }
          case 9: {
            const refund = PERK_REFUND_TIERS[Math.min(strength, PERK_REFUND_TIERS.length - 1)];
            if (refund > 0) {
              const res = await apiClient.post<{ success?: boolean; message?: string }>("/perks/apply-cash", {
                game_id: game.id,
                perk_id: 9,
                amount: refund,
                from_collectible: true,
              });
              success = perkApiSucceeded(res);
              if (success) {
                toast.success(`+$${refund} Tax Refund!`, { id: toastId });
              } else {
                failureMessage = getPerkApiMessage(res, getPerkFailureFallback(9));
              }
            }
            break;
          }
          case 6:
            if (selectedPositionIndex !== null) {
              const res = await apiClient.post<{ success?: boolean; data?: { new_position?: number }; message?: string }>("/perks/teleport", {
                game_id: game.id,
                target_position: selectedPositionIndex,
                from_collectible: true,
              });
              success = perkApiSucceeded(res);
              if (success) {
                if (triggerSpecialLanding) triggerSpecialLanding(selectedPositionIndex, true);
                toast.success(`${name} activated! Moved!`, { id: toastId });
              } else {
                failureMessage = getPerkApiMessage(res, getPerkFailureFallback(6));
              }
            } else {
              failureMessage = "Select a destination on the board first.";
            }
            break;
          case 10:
            if (selectedRollTotal != null && selectedRollTotal >= 2 && selectedRollTotal <= 12) {
              const res = await apiClient.post<{ success?: boolean; message?: string }>("/perks/exact-roll", {
                game_id: game.id,
                chosen_total: selectedRollTotal,
                from_collectible: true,
              });
              success = perkApiSucceeded(res);
              if (success) {
                toast.success(`Next roll will be ${selectedRollTotal}!`, { id: toastId });
              } else {
                failureMessage = getPerkApiMessage(res, getPerkFailureFallback(10));
              }
            } else {
              failureMessage = "Choose a roll total between 2 and 12.";
            }
            break;
        }

        if (success) {
          await refreshGameStateAfterPerk(onPerkApplied);
          toast.success(`${name} activated & collectible burned! 🔥`, { id: toastId });
        } else {
          toast.error(failureMessage ?? getPerkFailureFallback(perkId), { id: toastId });
        }
      } catch (err) {
        toast.error(getPerkActivationError(err, "Activation failed"), { id: toastId });
      } finally {
        burnConfirmedRef.current = false;
        resetBurn();
        setPendingPerk(null);
        setSelectedPositionIndex(null);
        setSelectedRollTotal(null);
      }
    })();
  }, [
    burnSuccess,
    pendingPerk,
    currentPlayer,
    ROLL_DICE,
    triggerSpecialLanding,
    selectedPositionIndex,
    selectedRollTotal,
    resetBurn,
    onPerkApplied,
    playerCanRoll,
    playerInJail,
    isMyTurn,
  ]);

  const handleConfirmBurnAndActivate = async () => {
    if (!pendingPerk) return;
    if (isBurning) {
      return;
    }

    const toastId = toast.loading("Burning collectible... 🔥");

    try {
      burnConfirmedRef.current = true;
      await burnCollectible(pendingPerk.tokenId);
    } catch (err) {
      burnConfirmedRef.current = false;
      resetBurn();
      toast.error("Burn failed — perk not activated", { id: toastId });
      setPendingPerk(null);
      setSelectedPositionIndex(null);
      setSelectedRollTotal(null);
    }
  };

  if (!isConnected && validAddresses.length === 0) return null;

  const burnConfirmOverlay = (
    <AnimatePresence>
      {pendingPerk && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[10050]"
            onClick={() => {
              setPendingPerk(null);
              setSelectedPositionIndex(null);
              setSelectedRollTotal(null);
            }}
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 280 }}
            className="
                fixed inset-x-0 bottom-0
                z-[10051]
                max-h-[85dvh]
                bg-[#0A1418]
                rounded-t-3xl
                border-t border-red-600/40
                shadow-2xl shadow-black/50
                overflow-y-auto
              "
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-center pt-3 pb-1 shrink-0 bg-[#0A1418]" aria-hidden>
              <div className="w-10 h-1 rounded-full bg-slate-500/60" />
            </div>
            <div className="p-6 text-center mb-15">
              <Flame className="w-20 h-20 text-red-500 mx-auto mb-6 animate-pulse" />
              <h2 className="text-3xl font-bold text-white mb-4">Burn Collectible?</h2>
              <p className="text-2xl text-cyan-300 font-semibold mb-6">{pendingPerk.name}</p>

              <p className="text-red-300 text-lg leading-relaxed mb-8">
                This action is <strong>permanent</strong>.<br />
                The collectible will be <strong>burned forever</strong>.
              </p>

              {(pendingPerk.perkId === 6 || pendingPerk.perkId === 10) && (
                <div className="mb-10">
                  <p className="text-xl text-white mb-6">
                    {pendingPerk.perkId === 6 ? "Choose destination:" : "Choose exact roll:"}
                  </p>

                  {pendingPerk.perkId === 6 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto">
                      {BOARD_POSITIONS.map((name, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedPositionIndex(i)}
                          className={`py-3 px-4 rounded-xl text-sm font-medium transition-colors ${
                            selectedPositionIndex === i
                              ? "bg-cyan-600 text-white shadow-md"
                              : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                          }`}
                        >
                          {i}. {name}
                        </button>
                      ))}
                    </div>
                  )}

                  {pendingPerk.perkId === 10 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {[2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSelectedRollTotal(n)}
                          className={`py-6 rounded-xl text-2xl font-bold transition-all ${
                            selectedRollTotal === n
                              ? "bg-cyan-600 text-white shadow-md scale-105"
                              : "bg-gray-800 hover:bg-gray-700 text-gray-200"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={() => {
                    setPendingPerk(null);
                    setSelectedPositionIndex(null);
                    setSelectedRollTotal(null);
                  }}
                  className="py-5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg transition"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmBurnAndActivate}
                  disabled={
                    isBurning ||
                    (pendingPerk.perkId === 6 && selectedPositionIndex === null) ||
                    (pendingPerk.perkId === 10 && selectedRollTotal === null)
                  }
                  className="py-5 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 disabled:opacity-60 text-white font-bold text-lg flex items-center justify-center gap-3 transition shadow-md"
                >
                  {isBurning ? (
                    <>
                      <Loader2 className="w-7 h-7 animate-spin" />
                      Burning...
                    </>
                  ) : (
                    <>
                      <Flame className="w-7 h-7" />
                      Burn & Use
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* PERKS LIST — mobile-optimized: compact header, 2-col grid, clear cards */}
      <div className="space-y-4 pb-8 px-1 sm:px-4 md:px-6">
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-[#00F0FF]/20 text-[#00F0FF] text-sm font-bold">
            {totalOwned}
          </span>
          <Link
            href={perkShopHref}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-[#003B3E] border border-[#00F0FF]/30 text-[#00F0FF] text-sm font-semibold hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/50 transition active:scale-[0.98]"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            Perk Shop
          </Link>
        </div>

        {totalOwned === 0 && (
          <p className="text-slate-400 text-sm py-3">No perks yet. Open the Perk Shop to get some.</p>
        )}

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {ownedCollectibles.map((item) => (
            <motion.button
              key={`${item.perk}-${item.strength}-${item.tokenId.toString()}`}
              whileTap={{ scale: 0.97 }}
              onClick={() => handleUsePerk(item.tokenId, item.perk, item.name, item.canBeActivated, item.strength)}
              disabled={!isMyTurn || !item.canBeActivated}
              className={`flex flex-col items-center gap-1.5 text-center transition-all
                ${!isMyTurn || !item.canBeActivated
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:opacity-90 active:scale-[0.98]"}
              `}
            >
              {/* Perk Image Container */}
              {item.shopImage && (
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 overflow-hidden rounded-lg border border-white/20 bg-black/30">
                  <Image
                    src={item.shopImage}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 80px, 100px"
                  />
                  {item.count > 1 && (
                    <span className="absolute top-0.5 right-0.5 rounded-md bg-black/80 px-1 py-0.5 text-[10px] font-bold text-white">
                      ×{item.count}
                    </span>
                  )}
                </div>
              )}

              {/* Text Below Image */}
              <div className="flex flex-col gap-0.5 w-full">
                <p className="font-semibold text-white text-[10px] sm:text-xs leading-tight line-clamp-2">{item.name}</p>
                {!isMyTurn && (
                  <span className="text-[9px] text-white/60">Wait</span>
                )}
                {item.canBeActivated && isMyTurn && (
                  <span className="text-[9px] text-white/60">Tap to use</span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {overlayPortalTarget
        ? createPortal(burnConfirmOverlay, overlayPortalTarget)
        : burnConfirmOverlay}
    </>
  );
}