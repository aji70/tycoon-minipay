import { apiClient } from "@/lib/api";
import { walletAuthParams, type WalletChain } from "@/lib/walletSession";

export type GoodDollarTrackEvent = "fv_started" | "fv_returned" | "fv_confirmed";

/**
 * Best-effort POST to /gooddollar/track. Never throws — FV UX must not break.
 */
export async function trackGoodDollarFv(opts: {
  event: GoodDollarTrackEvent;
  address?: string | null;
  chain?: WalletChain;
  source?: string;
  isVerified?: boolean;
  reason?: string | null;
}): Promise<void> {
  try {
    const params = walletAuthParams(opts.address ?? undefined, opts.chain ?? "CELO");
    const body: Record<string, unknown> = {
      event: opts.event,
      source: opts.source ?? "minipay",
      address: opts.address ?? undefined,
      isVerified: opts.isVerified === true,
      reason: opts.reason ?? undefined,
    };
    if (params) {
      await apiClient.post("gooddollar/track", { ...body, ...params });
    } else {
      await apiClient.post("gooddollar/track", body);
    }
  } catch (err) {
    console.warn("[gooddollar] track failed", err);
  }
}

/**
 * After GoodID redirect, query may include isVerified / reason.
 * Consume once, track, then strip params from the URL.
 */
export function consumeGoodDollarFvCallback(): {
  isVerified: boolean | null;
  reason: string | null;
} {
  if (typeof window === "undefined") {
    return { isVerified: null, reason: null };
  }
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get("isVerified") ?? url.searchParams.get("isverified");
    if (raw == null) {
      return { isVerified: null, reason: null };
    }
    const isVerified = raw === "true" || raw === "1";
    const reason = url.searchParams.get("reason");
    url.searchParams.delete("isVerified");
    url.searchParams.delete("isverified");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    return { isVerified, reason };
  } catch {
    return { isVerified: null, reason: null };
  }
}
