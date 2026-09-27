export function parseUrlList(text: string): string[] {
  const urls: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const firstCell = line
      .split(",")[0]!
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .trim();

    if (!firstCell || firstCell.toLowerCase() === "url") {
      continue;
    }

    urls.push(firstCell);
  }

  return urls;
}
