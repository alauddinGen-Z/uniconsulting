import type { NextConfig } from "next";

/**
 * Next.js Configuration
 * 
 * Supports two build modes:
 * - Standard (npm run build): SSR enabled for Netlify deployment
 * - Static Export (npm run build:export): For Electron desktop bundling
 * 
 * IMPORTANT: Static export does NOT support:
 * - API routes (/api/*) - use Supabase Edge Functions instead
 * - Dynamic routes without generateStaticParams
 * - Server-side features (getServerSideProps, headers(), etc.)
 * 
 * @file next.config.ts
 */

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

const nextConfig: NextConfig = {
  // Enable static export for Electron desktop builds
  ...(isStaticExport && {
    output: 'export',
    distDir: 'out',
    trailingSlash: true,
    // Static export cannot use Image optimization
    images: { unoptimized: true },
    // Skip API routes during static export (they don't work with static)
    // The desktop app uses Supabase Edge Functions instead
    experimental: {
      // Ignore TypeScript errors in API routes during static export
      // since they won't be included anyway
    },
  }),

  // Standard image config for web deployment
  ...(!isStaticExport && {
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'ylwyuogdfwugjexyhtrq.supabase.co',
          pathname: '/storage/v1/object/public/**',
        },
      ],
    },
  }),

  // CORS headers for Chrome Extension API access (only for SSR mode)
  ...(!isStaticExport && {
    async headers() {
      return [
        {
          source: '/api/ai/:path*',
          headers: [
            { key: 'Access-Control-Allow-Credentials', value: 'true' },
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
            { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
          ],
        },
      ];
    },
  }),

  // Environment variables accessible in client
  env: {
    NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE || 'full',
    NEXT_PUBLIC_STATIC_EXPORT: process.env.NEXT_PUBLIC_STATIC_EXPORT || 'false',
  },
};

export default nextConfig;
