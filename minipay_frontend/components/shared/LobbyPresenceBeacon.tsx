"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { useGetUsername } from "@/context/contractReads";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { isAddress } from "viem";

/**
 * Silent beacon: any signed-in MiniPay user registers lobby presence
 * so they appear in the global online list (even if they can't see the UI).
 */
export default function LobbyPresenceBeacon() {
  const { address, isConnected } = useAccount();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;

  const safeAddress =
    address && isAddress(address) ? (address as `0x${string}`) : undefined;
  const { data: onChainUsername } = useGetUsername(safeAddress);

  const presenceAddress = useMemo(() => {
    if (address) return address;
    if (guestUser) return getGuestUserPlayAddress(guestUser) ?? guestUser.address ?? undefined;
    return undefined;
  }, [address, guestUser]);

  const username =
    guestUser?.username ??
    (onChainUsername != null ? String(onChainUsername).trim() : null);

  const enabled = !!(isConnected || guestUser) && !!(presenceAddress || username || guestUser?.id);

  // Registers presence + keeps socket lobby membership fresh.
  // We don't render the list here — WhoIsOnlineControl does that for preview users.
  useOnlineUsers(presenceAddress, {
    enabled,
    userId: guestUser?.id,
    username,
    pollIntervalMs: 12000,
  });

  return null;
}
