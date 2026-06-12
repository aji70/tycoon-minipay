"use client";

import { Suspense } from "react";
import ProfilePageMobile from "@/components/profile/profile-mobile";
import VerifyEmailFromQuery from "@/components/auth/VerifyEmailFromQuery";

export default function ProfileClient() {
  return (
    <main className="w-full">
      <Suspense fallback={null}>
        <VerifyEmailFromQuery />
      </Suspense>
      <ProfilePageMobile />
    </main>
  );
}
