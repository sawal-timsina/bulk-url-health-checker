import { HttpError } from "../lib/errors.js";
import { normalizeUrl } from "../utils/url.js";

export function validateUrls(inputs: string[]): string[] {
  const valid: string[] = [];
  const invalid: Array<{ input: string; reason: string }> = [];

  for (const result of inputs.map(normalizeUrl)) {
    if (result.ok) {
      valid.push(result.url);
    } else {
      invalid.push({ input: result.input, reason: result.reason });
    }
  }

  if (invalid.length > 0) {
    throw new HttpError(400, "INVALID_URLS", `${invalid.length} URL(s) are invalid`, invalid);
  }

  // Duplicates would violate (batch_id, url) and do the same work twice.
  return [...new Set(valid)];
}
