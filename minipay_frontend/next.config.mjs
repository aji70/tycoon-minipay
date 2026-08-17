import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { withSentryConfig } from "@sentry/nextjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const emptyPolyfill = path.join(__dirname, "lib/empty-polyfill.js");
const nextPolyfillModule = require.resolve(
  "next/dist/build/polyfills/polyfill-module.js"
);

/**
 * Build memory (Vercel / small CI runners):
 * - Lower parallelism: set NEXT_BUILD_CPUS=1 in project env if builds still OOM (default 2).
 * - Skip Sentry source-map upload step: set SENTRY_DISABLE_SOURCEMAP_UPLOAD=1 (saves RAM during build).
 */
const buildCpus = Math.min(
  4,
  Math.max(1, Number.parseInt(process.env.NEXT_BUILD_CPUS || "2", 10) || 2)
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Ignore type errors in dependencies (e.g. @ethereumjs/tx overload signature)
    ignoreBuildErrors: true,
  },
  productionBrowserSourceMaps: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  /**
   * Next 14 always imports `polyfill-module` from the client runtime (trimStart, .at, etc.).
   * Browserslist/SWC only affect syntax downleveling — not this file. Stub it for MiniPay.
   */
  webpack(config, { isServer, webpack }) {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        [nextPolyfillModule]: emptyPolyfill,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /polyfills[\\/]polyfill-module(\.js)?$/,
          emptyPolyfill
        )
      );
    }
    return config;
  },
  experimental: {
    cssChunking: "strict",
    // Fewer parallel compile workers → lower peak RSS (slower build).
    cpus: buildCpus,
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
      "@tanstack/react-query",
      "wagmi",
      "viem",
      "framer-motion",
      "react-type-animation",
    ],
  },
  async redirects() {
    return [
      {
        source: '/.well-known/farcaster.json',
        destination: 'https://api.farcaster.xyz/miniapps/hosted-manifest/019b9413-dacb-6826-2d02-09f283211209',
        permanent: false, // This ensures a temporary 307 redirect
        statusCode: 307,  // Explicitly set to 307 (recommended by Farcaster)
      },
      {
        source: '/verify-email',
        destination: '/profile',
        permanent: false,
      },
    ];
  },
  /** Safe defaults; CSP/HSTS/COOP are usually set at the edge (Vercel) to avoid breaking wallet popups / miniapps. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const disableSentrySourcemaps =
  process.env.SENTRY_DISABLE_SOURCEMAP_UPLOAD === "1" || !sentryAuthToken;

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG ?? undefined,
  project: process.env.SENTRY_PROJECT ?? undefined,
  ...(disableSentrySourcemaps
    ? {
        sourcemaps: {
          disable: true,
        },
      }
    : {
        authToken: sentryAuthToken,
      }),
});

