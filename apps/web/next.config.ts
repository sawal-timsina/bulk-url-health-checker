import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import * as path from "node:path";

const repoRoot = path.resolve(process.cwd(), "../..");

const rootEnvFile = path.join(repoRoot, ".env");

if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  transpilePackages: ["@bulk-url-checker/shared"],
};

export default nextConfig;
