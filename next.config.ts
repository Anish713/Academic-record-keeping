import type { NextConfig } from "next";

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config: any) => {
    // Enable WebAssembly support for ZK circuits
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    return config;
  },
};

export default nextConfig;
