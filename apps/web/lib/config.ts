import "server-only";
import { z } from "zod";

/*
 * Server-side only (the `server-only` import makes a client import a build
 * error). Nothing here needs NEXT_PUBLIC_: values the browser needs are
 * passed down as props from Server Components, so they're read at request
 * time and the same build runs in any environment.
 */
const envSchema = z.object({
  // How the Next server reaches the API (may be an internal address).
  API_URL: z.url({ protocol: /^https?$/ }),
  // How the browser reaches the API for live updates; defaults to API_URL.
  PUBLIC_API_URL: z.url({ protocol: /^https?$/ }).optional(),
});

export interface ServerConfig {
  apiUrl: string;
  publicApiUrl: string;
}

let cached: ServerConfig | undefined;

/**
 * Parsed on first use rather than at import: `next build` loads these
 * modules while prerendering checks run, when no runtime environment exists.
 */
export function getServerConfig(): ServerConfig {
  if (cached) {
    return cached;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(`Invalid environment for the web app:\n${z.prettifyError(result.error)}`);
  }

  cached = {
    apiUrl: result.data.API_URL,
    publicApiUrl: result.data.PUBLIC_API_URL ?? result.data.API_URL,
  };

  return cached;
}
