import { showBoardNotice, type BoardNoticeSeverity } from "@/lib/boardNotice";
import { getContractErrorMessage } from "./contractErrors";

type HeroNoticeOptions = { severity?: BoardNoticeSeverity };

function showHeroNotice(message: string, severity: BoardNoticeSeverity) {
  const msg = message.trim();
  if (!msg) return;
  console.warn("[hero]", msg);
  showBoardNotice(msg, severity);
}

/** Error feedback on the hero: notice strip (no error toasts). */
export function heroToastError(message: string, options?: HeroNoticeOptions): void {
  showHeroNotice(message, options?.severity ?? "error");
}

/** Info / guidance on the hero: notice strip. */
export function heroToastInfo(message: string): void {
  showHeroNotice(message, "info");
}

/** Warnings on the hero: notice strip. */
export function heroToastWarning(message: string): void {
  showHeroNotice(message, "warning");
}

/** Contract/API errors on the hero: notice strip. */
export function heroContractError(error: unknown, fallback: string): void {
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  console.warn("[hero]", error);
  showHeroNotice(msg, "error");
}
