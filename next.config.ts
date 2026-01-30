import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  reactStrictMode: false,
  transpilePackages: ['react-map-gl', '@deck.gl/react', '@deck.gl/layers', 'deck.gl', 'maplibre-gl'],
};

export default nextConfig;
