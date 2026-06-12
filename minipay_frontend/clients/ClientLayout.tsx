"use client";

import dynamic from "next/dynamic";
import NavBarMobile from "@/components/shared/navbar-mobile";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import { isPublicPath } from "@/lib/publicPaths";

const ProfileProvider = dynamic(
  () => import("@/context/ProfileContext").then((m) => ({ default: m.ProfileProvider })),
  { ssr: false }
);
const AuthGuard = dynamic(() => import("@/components/auth/AuthGuard"), { ssr: false });

interface ClientLayoutProps {
  children: ReactNode;
  cookies?: string | null;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();
  const isBoard3D = pathname === "/board-3d-mobile" || pathname === "/board-3d-multi-mobile";
  const isPublic = isPublicPath(pathname ?? "");
  const needsMobileNavPadding = !isBoard3D;
  const contentClassName = [
    needsMobileNavPadding ? "pt-below-mobile-nav" : "",
    !isBoard3D ? "max-w-md mx-auto w-full" : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div suppressHydrationWarning className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}>
        {children}
      </div>
    );
  }

  const pageContent = (
    <div className={contentClassName || undefined}>{children}</div>
  );

  return (
    <ProfileProvider>
      <div suppressHydrationWarning className={`${orbitron.variable} ${dmSans.variable} ${kronaOne.variable}`}>
        {isBoard3D ? (
          <NavBarMobile minimal />
        ) : (
          <div className="max-w-md mx-auto w-full">
            <NavBarMobile />
          </div>
        )}
        {isPublic ? pageContent : <AuthGuard>{pageContent}</AuthGuard>}
      </div>
    </ProfileProvider>
  );
}
