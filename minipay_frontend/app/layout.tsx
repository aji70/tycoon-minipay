import dynamic from "next/dynamic";
import "@/styles/critical.css";
import { headers } from "next/headers";
import ContextProvider from "@/context";
import AppKitProviderWrapper from "@/components/AppKitProviderWrapper";
import DeferredGuestAuthProvider from "@/components/DeferredGuestAuthProvider";
import { Toaster } from "react-hot-toast";
import { minikitConfig } from "../minikit.config";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import ClientLayout from "../clients/ClientLayout";
import MinipaySiteRedirect from "@/components/MinipaySiteRedirect";
import DeferredMinipayAutoConnect from "@/components/DeferredMinipayAutoConnect";
import DeferredToasts from "@/components/DeferredToasts";
import { buildMinipaySiteRedirectScript } from "@/lib/minipaySiteRedirect";

const ScrollToTopBtn = dynamic(() => import("@/components/shared/scroll-to-top-btn"), { ssr: false });
const FarcasterReady = dynamic(() => import("@/components/FarcasterReady"), { ssr: false });
const BfcacheReloadGuard = dynamic(() => import("@/components/BfcacheReloadGuard"), { ssr: false });
const ReferralCapture = dynamic(() => import("@/components/ReferralCapture"), { ssr: false });
const DeferredUiStyles = dynamic(() => import("@/components/DeferredUiStyles"), { ssr: false });

const CRITICAL_SHELL_CSS = [
  ":root{--mobile-nav-height:82px;--mobile-nav-offset:calc(var(--mobile-nav-height) + env(safe-area-inset-top,0px));--font-dm-sans:ui-sans-serif,system-ui,sans-serif;--font-krona-one:ui-sans-serif,system-ui,sans-serif;--font-orbitron-sans:ui-sans-serif,system-ui,sans-serif}",
  "html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}",
  "body{margin:0;background:#010F10;color:#F0F7F7;width:100%}",
  ".pt-below-mobile-nav{padding-top:var(--mobile-nav-offset)}",
  ".min-h-below-mobile-nav{min-height:calc(100dvh - var(--mobile-nav-offset))}",
  ".neon-title-hero{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}",
  ".neon-title-text{position:relative;z-index:1;display:block;text-shadow:0 0 8px rgba(0,240,255,.8),0 0 16px rgba(0,240,255,.6)}",
  ".neon-title-glow-pulse{position:absolute;inset:0;display:block;color:inherit;pointer-events:none;opacity:.55;text-shadow:0 0 10px rgba(0,240,255,.9),0 0 20px rgba(15,240,252,.75)}",
].join("");

// Run before React: (1) Reload board when restored from bfcache so WebGL is fresh. (2) Disable bfcache on board so back button does full load instead of restore (avoids Context Lost + .style crash).
const BFCACHE_RELOAD_SCRIPT = `
(function(){
  var boardPath = /\\/board-3d-(mobile|multi-mobile)(\\/|$)/;
  function isBoard() { return boardPath.test(window.location.pathname); }
  window.addEventListener('pageshow', function(e) {
    if (e.persisted && isBoard()) { window.location.reload(); }
  });
  if (isBoard()) {
    window.addEventListener('unload', function() {});
  }
})();
`;

// Remove the duplicate 'cookies' global variable—it's not needed

/** Safe metadataBase — invalid env (missing protocol, spaces) must not 500 the whole site. */
function resolveMetadataBase(): URL {
  const fallback = "https://www.playtycoon.xyz";
  const raw = (process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const candidate = raw || fallback;
  try {
    if (/^https?:\/\//i.test(candidate)) {
      return new URL(candidate);
    }
    return new URL(`https://${candidate}`);
  } catch {
    return new URL(fallback);
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: resolveMetadataBase(),
    title: {
      default: "Tycoon — On-chain Monopoly on Celo",
      template: "%s | Tycoon",
    },
    description:
      "Tycoon is a decentralized on-chain game inspired by the classic Monopoly game, built on Celo. It allows players to buy, sell, and trade digital properties in a trustless gaming environment.",
    icons: {
      icon: [
        { url: "/favicon.png", sizes: "192x192", type: "image/png" },
        { url: "/metadata/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/metadata/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: [{ url: "/metadata/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
      shortcut: [{ url: "/metadata/favicon.ico", sizes: "48x48", type: "image/x-icon" }],
    },
    other: {
      "talentapp:project_verification":
        "5d078ddf22e877e4b4a4508b55b82c826e0b7d2bef4d1505b4b14945a216f62eaf013de3c9fe99c4fd58ae7fc896455a9ada31130565d32c8a5eb785b394113a",
      "base:app_id": "695d328c3ee38216e9af4359", 
      "fc:frame": JSON.stringify({
        version: minikitConfig.miniapp.version,
        imageUrl: minikitConfig.miniapp.heroImageUrl,
        images: {
          url: minikitConfig.miniapp.heroImageUrl,
          alt: "Tycoon - Monopoly Game Onchain",
        },
        button: {
          title: `Play ${minikitConfig.miniapp.name} `,
          action: {
            name: `Launch ${minikitConfig.miniapp.name}`,
            type: "launch_frame",
          },
        },
      }),
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie"); // Local var—no need for global

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CRITICAL_SHELL_CSS }} />
      </head>

      <body className="antialiased bg-[#010F10] w-full">
        <Script id="bfcache-reload" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: BFCACHE_RELOAD_SCRIPT }} />
        <Script
          id="minipay-site-redirect"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: buildMinipaySiteRedirectScript() }}
        />
        <MinipaySiteRedirect />
        <FarcasterReady />
        <ContextProvider cookies={cookies}>
              <DeferredGuestAuthProvider>
              <ReferralCapture />
              <AppKitProviderWrapper>
                <DeferredMinipayAutoConnect />
                <BfcacheReloadGuard />
                <ClientLayout cookies={cookies}>
                  {children}
                </ClientLayout>

                <ScrollToTopBtn />
                <DeferredUiStyles />
                <DeferredToasts />
                <Toaster
                  position="top-center"
                  containerStyle={{
                    zIndex: 2147483647,
                    top: "max(1rem, calc(env(safe-area-inset-top) + 0.5rem))",
                  }}
                />
              </AppKitProviderWrapper>
              </DeferredGuestAuthProvider>
        </ContextProvider>
      </body>
    </html>
  );
}