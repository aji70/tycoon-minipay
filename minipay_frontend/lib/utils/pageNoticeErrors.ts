import { showBoardNotice, type BoardNoticeSeverity } from "@/lib/boardNotice";
import { getContractErrorMessage } from "./contractErrors";

type PageNoticeOptions = { severity?: BoardNoticeSeverity };

function showPageNotice(message: string, severity: BoardNoticeSeverity) {
  const msg = message.trim();
  if (!msg) return;
  console.warn("[page-notice]", msg);
  showBoardNotice(msg, severity);
}

/** Error feedback: notice strip (no error toasts). */
export function pageToastError(message: string, options?: PageNoticeOptions): void {
  showPageNotice(message, options?.severity ?? "error");
}

/** Info / guidance: notice strip. */
export function pageToastInfo(message: string): void {
  showPageNotice(message, "info");
}

/** Warnings: notice strip. */
export function pageToastWarning(message: string): void {
  showPageNotice(message, "warning");
}

/** Contract/API errors: notice strip. */
export function pageContractError(error: unknown, fallback: string): void {
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  console.warn("[page-notice]", error);
  showPageNotice(msg, "error");
}
