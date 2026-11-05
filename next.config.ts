import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas las páginas leen la sesión y resultados en directo: render dinámico clásico.
  cacheComponents: false,
  serverExternalPackages: ["pg"],
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // No anunciar con qué está hecha la web.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nadie puede meter la web dentro de un iframe (clickjacking sobre el panel).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
