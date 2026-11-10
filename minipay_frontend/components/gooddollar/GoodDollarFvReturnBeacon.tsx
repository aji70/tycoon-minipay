"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { consumeGoodDollarFvCallback, trackGoodDollarFv } from "@/lib/gooddollar/trackFv";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { getGuestUserPlayAddress } from "@/lib/minipayGuestFlow";

/**
 * When GoodID redirects back with ?isVerified=..., record the outcome once.
 * Also relies on /gooddollar/status stamping gd_verified_at when on-chain whitelist flips.
 */
export default function GoodDollarFvReturnBeacon() {
  const ran = useRef(false);
  const { address } = useAccount();
  const guestUser = useGuestAuthOptional()?.guestUser ?? null;

  useEffect(() => {
    if (ran.current) return;
    const { isVerified, reason } = consumeGoodDollarFvCallback();
    if (isVerified == null) return;
    ran.current = true;
    const wallet =
      address ||
      getGuestUserPlayAddress(guestUser) ||
      null;
    void trackGoodDollarFv({
      event: "fv_returned",
      address: wallet,
      source: "minipay_callback",
      isVerified,
      reason,
    });
  }, [address, guestUser]);

  return null;
}
