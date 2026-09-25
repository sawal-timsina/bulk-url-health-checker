import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import * as path from "node:path";

loadEnvConfig(path.resolve(__dirname, "../.."));

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ["@bulk-url-checker/shared"],
};

export default nextConfig;
