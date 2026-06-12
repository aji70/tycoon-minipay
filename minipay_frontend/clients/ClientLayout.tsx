"use client";

import NavBarMobile from "@/components/shared/navbar-mobile";
import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { dmSans, kronaOne, orbitron } from "@/components/shared/fonts";
import { ProfileProvider } from "@/context/ProfileContext";
import AuthGuard from "@/components/auth/AuthGuard";

interface ClientLayoutProps {
  children: ReactNode;
  cookies?: string | null;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();
  const isBoard3D = pathname === "/board-3d-mobile" || pathname === "/board-3d-multi-mobile";
  const isHome = pathname === "/";
  const needsMobileNavPadding = !isBoard3D && !isHome;
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
        <AuthGuard>
          <div className={contentClassName || undefined}>{children}</div>
        </AuthGuard>
      </div>
    </ProfileProvider>
  );
}
