import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

// Local dev reads the repo-root .env; in containers the variables come from
// compose and a missing file is simply ignored. Existing variables win.
expand(loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true }));

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  API_HOST: z.string().min(1).default("0.0.0.0"),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  // Fail at boot with every problem listed, not mid-request with one.
  if (!result.success) {
    throw new Error(`Invalid environment for the API:\n${z.prettifyError(result.error)}`);
  }

  const env = result.data;

  return {
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    port: env.API_PORT,
    host: env.API_HOST,
  } as const;
}

/** Validated, typed configuration. Import this module first in the entrypoint. */
export const config = loadConfig();

export type Config = typeof config;
