import toast, { type ToastOptions } from "react-hot-toast";
import { showBoardNotice, type BoardNoticeSeverity } from "@/lib/boardNotice";
import {
  getContractErrorMessage,
  getTradeErrorMessage,
  isBenignTurnOrderError,
} from "./contractErrors";

export function isBoardGameRoute(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.includes("/board-3d");
}

type BoardErrorOptions = ToastOptions & { severity?: BoardNoticeSeverity };

function showOnBoard(message: string, severity: BoardNoticeSeverity = "error") {
  console.warn("[board-game]", message);
  showBoardNotice(message, severity);
}

/** Error feedback on the live board: notice strip (no error toasts). */
export function gameBoardToastError(message: string, options?: BoardErrorOptions): void {
  const msg = message.trim();
  if (!msg || isBenignTurnOrderError({ message: msg })) return;
  if (isBoardGameRoute()) {
    showOnBoard(msg, options?.severity ?? "error");
    return;
  }
  toast.error(msg, options);
}

/** Contract/API errors on the live board: notice strip. */
export function gameBoardContractError(
  error: unknown,
  fallback: string,
  options?: BoardErrorOptions
): void {
  if (isBenignTurnOrderError(error)) return;
  const msg = getContractErrorMessage(error, fallback).trim();
  if (!msg) return;
  if (isBoardGameRoute()) {
    showOnBoard(msg, options?.severity ?? "error");
    console.warn("[board-game]", error);
    return;
  }
  toast.error(msg, options);
}

/** Trade errors on the live board: notice strip. */
export function gameBoardTradeError(error: unknown, fallback: string): void {
  if (isBenignTurnOrderError(error)) return;
  const msg = getTradeErrorMessage(error, fallback).trim();
  if (!msg) return;
  if (isBoardGameRoute()) {
    showOnBoard(msg, "error");
    console.warn("[board-game:trade]", error);
    return;
  }
  toast.error(msg);
}
