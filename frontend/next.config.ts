import type { NextConfig } from "next";
import createMDX from "@next/mdx";

// Security headers to apply to all routes
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    // Content Security Policy
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://steve-p.org",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  output: 'standalone',

  // .mdx is only used for the versioned legal documents (src/content/legal)
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],

  // Image optimization for better caching
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year for optimized images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'steve-p.org',
      },
    ],
  },

  // Aggressive caching headers for static assets — PRODUCTION ONLY.
  // Dev (Turbopack) chunk filenames are stable across code changes, so
  // immutable/1-year headers make the browser keep stale chunks and new
  // code silently never renders (see docs/notes/bugs.md 2026-08-27).
  // Prod chunk names are content-hashed, so long-lived caching is safe there.
  async headers() {
    const security = {
      // Apply security headers to all routes
      source: '/:path*',
      headers: securityHeaders,
    };
    if (process.env.NODE_ENV !== 'production') {
      return [security];
    }
    return [
      security,
      {
        // Cache static assets (JS, CSS, fonts, images) for 1 year
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp|avif|woff|woff2|ttf|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache Next.js static files (/_next/static/*) for 1 year
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache optimized images for 1 year
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache public folder assets for 1 year
        source: '/planets/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache blog images for 1 year
        source: '/blog/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

// No remark/rehype plugins: Turbopack cannot serialise plugin functions
const withMDX = createMDX();

export default withMDX(nextConfig);
