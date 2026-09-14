import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // ADR-005: Compute in Frankfurt. Keine Edge-Runtime fuer Routen mit Personendaten.
  serverExternalPackages: [],
};

export default nextConfig;
