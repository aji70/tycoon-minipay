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
  const isBoard3DMobile = pathname === "/board-3d-mobile" || pathname === "/board-3d-multi-mobile";
  const isHome = pathname === "/";
  const needsMobileNavPadding = !isBoard3DMobile && !isHome;

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
        <NavBarMobile minimal={isBoard3DMobile} />
        <AuthGuard>
          <div className={needsMobileNavPadding ? "pt-below-mobile-nav" : undefined}>
            {children}
          </div>
        </AuthGuard>
      </div>
    </ProfileProvider>
  );
}
