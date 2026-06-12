"use client";

import JoinRoomMobile from "@/components/settings/join-room-mobile";

const REDIRECT_BOARD_MOBILE = "/board-3d-multi-mobile";
const REDIRECT_WAITING = "/game-waiting-3d";
const REDIRECT_CREATE = "/game-settings-3d";

/** Join room for multiplayer 3D (MiniPay mobile). */
export default function JoinRoom3DPage() {
  return (
    <main className="w-full">
      <JoinRoomMobile
        redirectToBoard={REDIRECT_BOARD_MOBILE}
        redirectToWaiting={REDIRECT_WAITING}
        redirectCreateNew={REDIRECT_CREATE}
      />
    </main>
  );
}
