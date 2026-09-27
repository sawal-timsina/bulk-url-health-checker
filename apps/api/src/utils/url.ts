export type NormalizeResult = { ok: true; url: string } | { ok: false; input: string; reason: string };

export function normalizeUrl(input: string): NormalizeResult {
  const value = input.trim();

  if (!value) {
    return { ok: false, input, reason: "URL cannot be empty" };
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, input, reason: "Not a valid absolute URL" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, input, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  // Fragments never reach the server, so they'd only create false duplicates.
  parsed.hash = "";

  return { ok: true, url: parsed.toString() };
}
