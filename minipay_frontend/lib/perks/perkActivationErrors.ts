import type { ApiResponse } from "@/types/api";

type MessageCarrier = {
  message?: string;
  error?: string;
  success?: boolean;
  data?: { message?: string; error?: string; [key: string]: unknown };
};

/** Read a human-readable failure message from an apiClient response (HTTP 200 with success:false). */
export function getPerkApiMessage(
  res?: ApiResponse<MessageCarrier> | MessageCarrier | null,
  fallback = "Failed to activate perk"
): string {
  if (!res) return fallback;
  const wrapped = res as ApiResponse<MessageCarrier>;
  const body = wrapped.data ?? (res as MessageCarrier);
  const nested = body?.data;
  const candidates = [body?.message, body?.error, nested?.message, nested?.error, wrapped.message];
  for (const msg of candidates) {
    const trimmed = typeof msg === "string" ? msg.trim() : "";
    if (trimmed && trimmed !== "Request successful") return trimmed;
  }
  return fallback;
}

export function perkApiSucceeded(res?: ApiResponse<{ success?: boolean }> | null): boolean {
  return res?.data?.success === true;
}

/** Read message from a thrown ApiError / axios error. */
export function getPerkActivationError(err: unknown, fallback = "Failed to activate perk"): string {
  const e = err as {
    response?: { data?: { message?: string; error?: string } };
    message?: string;
  };
  const msg = e?.response?.data?.message || e?.response?.data?.error || e?.message || "";
  const trimmed = msg.trim();
  return trimmed || fallback;
}

export type PerkPreBurnContext = {
  perkId: number;
  isMyTurn: boolean;
  playerCanRoll?: boolean;
  inJail?: boolean;
  rolls?: number;
};

const PERK_FAILURE_FALLBACK: Record<number, string> = {
  1: "Extra Turn cannot be used right now.",
  2: "Jail Free Card can only be used while you are in Jail.",
  3: "Double Rent cannot be activated right now.",
  4: "Roll Boost cannot be activated right now.",
  5: "Instant Cash cannot be used right now.",
  6: "Teleport cannot be used right now.",
  7: "Shield cannot be activated right now.",
  8: "Property Discount cannot be activated right now.",
  9: "Tax Refund cannot be activated right now. It applies when you pay Income or Luxury Tax.",
  10: "Exact Roll cannot be used right now.",
  11: "Rent Cashback cannot be activated right now.",
  12: "Interest cannot be activated right now.",
  13: "Lucky 7 cannot be activated right now.",
  14: "Free Parking Bonus cannot be activated right now.",
};

export function getPerkFailureFallback(perkId: number): string {
  return PERK_FAILURE_FALLBACK[perkId] ?? "Failed to activate perk";
}

/** Block burn before wallet tx when we already know activation will fail. */
export function getPerkPreBurnBlockMessage(ctx: PerkPreBurnContext): string | null {
  if (!ctx.isMyTurn) return "Wait for your turn!";
  switch (ctx.perkId) {
    case 1:
      if (Number(ctx.rolls ?? 0) < 1) {
        return "Extra Turn can only be used after you've rolled once this turn.";
      }
      break;
    case 2:
      if (ctx.inJail === false) {
        return "Jail Free Card can only be used while you are in Jail.";
      }
      break;
  }
  return null;
}
