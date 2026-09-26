export function normalizeUrl(input: string): string {
  const value = input.trim();

  if (!value) {
    throw new Error("URL cannot be empty");
  }

  const parsed = new URL(value);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  }

  return parsed.toString();
}
