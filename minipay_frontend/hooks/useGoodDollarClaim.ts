"use client";

import { useCallback, useMemo } from "react";
import { type Address, type PublicClient } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ClaimSDK, IdentitySDK } from "@goodsdks/citizen-sdk";
import { GD_CELO_CHAIN_ID, GD_ENV } from "@/lib/gooddollar/constants";
import { trackGoodDollarFv } from "@/lib/gooddollar/trackFv";

/**
 * MiniPay port of web GoodDollar UBI claim (ClaimSDK + IdentitySDK).
 * Claims to the connected MiniPay / injected wallet on Celo.
 */
export function useGoodDollarClaim() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient() as PublicClient | undefined;
  const { data: walletClient } = useWalletClient();

  const onCelo = chainId === GD_CELO_CHAIN_ID;

  const sdks = useMemo(() => {
    if (!address || !publicClient || !walletClient) return null;
    const identitySDK = new IdentitySDK({
      account: address as Address,
      publicClient,
      walletClient,
      env: GD_ENV,
    });
    const claimSDK = new ClaimSDK({
      account: address as Address,
      publicClient,
      walletClient,
      identitySDK,
      env: GD_ENV,
    });
    return { identitySDK, claimSDK };
  }, [address, publicClient, walletClient]);

  const refreshStatus = useCallback(async () => {
    if (!sdks) return null;
    return sdks.claimSDK.getWalletClaimStatus();
  }, [sdks]);

  const startVerification = useCallback(async () => {
    if (!sdks) throw new Error("Connect your MiniPay wallet on Celo first");
    await trackGoodDollarFv({
      event: "fv_started",
      address,
      source: "minipay_claim",
    });
    const callbackUrl = typeof window !== "undefined" ? window.location.href : undefined;
    const link = await sdks.identitySDK.generateFVLink(false, callbackUrl, GD_CELO_CHAIN_ID);
    if (typeof window !== "undefined") {
      window.location.assign(link);
    }
    return link;
  }, [sdks, address]);

  const claim = useCallback(async () => {
    if (!sdks) throw new Error("Connect your MiniPay wallet on Celo first");
    return sdks.claimSDK.claim();
  }, [sdks]);

  return {
    address,
    isConnected,
    onCelo,
    sdksReady: Boolean(sdks),
    refreshStatus,
    startVerification,
    claim,
  };
}
