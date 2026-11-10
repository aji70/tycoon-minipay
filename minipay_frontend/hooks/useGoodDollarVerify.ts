"use client";

import { useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { type Address, type PublicClient } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { IdentitySDK } from "@goodsdks/citizen-sdk";
import { GD_CELO_CHAIN_ID, GD_ENV } from "@/lib/gooddollar/constants";
import { trackGoodDollarFv } from "@/lib/gooddollar/trackFv";

const NOT_READY_MSG =
  "Connect your MiniPay wallet on Celo, then try Verify again.";
const FAILED_MSG =
  "Couldn't start GoodDollar verification. Reconnect your wallet and retry.";

/**
 * MiniPay-local port of main Tycoon's GoodDollar verify flow. The bare
 * https://goodid.gooddollar.org/ URL lands on FVFlowError because the Face
 * Verification page needs an SDK-signed login payload. `generateFVLink` builds
 * that payload for the connected wallet; we then assign (not open) so the
 * MiniPay in-app browser follows it without a popup block.
 *
 * We intentionally do NOT fall back to the bare GoodID URL — that is the
 * broken state we're fixing. If the SDK can't be built (no wallet client yet)
 * or `generateFVLink` throws, surface a toast telling the player to connect,
 * and let the UI keep the CTA disabled via `sdkReady`.
 */
export function useGoodDollarVerify() {
  const { address } = useAccount();
  const publicClient = usePublicClient() as PublicClient | undefined;
  const { data: walletClient } = useWalletClient();

  const identitySDK = useMemo(() => {
    if (!address || !publicClient || !walletClient) return null;
    return new IdentitySDK({
      account: address as Address,
      publicClient,
      walletClient,
      env: GD_ENV,
    });
  }, [address, publicClient, walletClient]);

  const startVerification = useCallback(async () => {
    if (typeof window === "undefined") return false;

    if (!identitySDK) {
      toast.error(NOT_READY_MSG);
      return false;
    }

    try {
      const callbackUrl = window.location.href;
      await trackGoodDollarFv({
        event: "fv_started",
        address,
        source: "minipay",
      });
      const link = await identitySDK.generateFVLink(
        false,
        callbackUrl,
        GD_CELO_CHAIN_ID,
      );
      window.location.assign(link);
      return true;
    } catch (err) {
      console.warn("[gooddollar] generateFVLink failed", err);
      toast.error(FAILED_MSG);
      return false;
    }
  }, [identitySDK, address]);

  return {
    sdkReady: Boolean(identitySDK),
    startVerification,
  };
}
