import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas las páginas leen la sesión y resultados en directo: render dinámico clásico.
  cacheComponents: false,
  serverExternalPackages: ["pg"],
  // Las imágenes para redes leen sus fuentes y el logo del disco: que viajen con la función.
  outputFileTracingIncludes: { "/admin/redes/imagen": ["./src/modulos/redes/fuentes/*.woff", "./public/marca/ceeps.svg"] },
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
