import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

// Local dev reads the repo-root .env; in containers the variables come from
// compose and a missing file is simply ignored. Existing variables win.
expand(loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true }));

/*
 * Only deployment settings live here. The processing guarantees (5 in flight,
 * 10 req/s, 3 retries) are requirements, so they're constants in
 * packages/queue rather than values an environment could quietly change.
 */
const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(`Invalid environment for the worker:\n${z.prettifyError(result.error)}`);
  }

  return {
    databaseUrl: result.data.DATABASE_URL,
    redisUrl: result.data.REDIS_URL,
  } as const;
}

/** Validated, typed configuration. Import this module first in the entrypoint. */
export const config = loadConfig();

export type Config = typeof config;
