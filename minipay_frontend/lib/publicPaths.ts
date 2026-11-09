export const PUBLIC_PATHS = [
  "/",
  "/join-room-3d",
  "/leaderboard",
  "/stats",
  "/terms",
  "/privacy",
  "/cookies",
  "/how-to-play",
] as const;

export function isPublicPath(pathname: string): boolean {
  const path = pathname?.split("?")[0] ?? "";
  if (path.startsWith("/u/")) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
