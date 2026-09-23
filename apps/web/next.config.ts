import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Clés partagées avec le worker : un seul .env.local, à la racine du repo (jamais commité).
const rootEnv = new URL("../../.env.local", import.meta.url);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Packages internes publiés en sources TypeScript (ADR 0002).
  transpilePackages: ["@coly/core", "@coly/ui", "@coly/worker"],
  // Accès depuis le téléphone via Tailscale (réseau privé), jamais une URL publique.
  allowedDevOrigins: ["**.ts.net"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
