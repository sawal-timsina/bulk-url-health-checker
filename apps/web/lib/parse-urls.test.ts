import assert from "node:assert/strict";
import { test } from "node:test";
import { parseUrlList } from "./parse-urls.ts";

test("one URL per line, ignoring blank lines", () => {
  assert.deepEqual(parseUrlList("https://a.com\n\n  https://b.com  \r\n"), ["https://a.com", "https://b.com"]);
});

test("CSV: first column, header skipped, quotes stripped", () => {
  const csv = 'url,label\n"https://a.com",A\nhttps://b.com,B\n';

  assert.deepEqual(parseUrlList(csv), ["https://a.com", "https://b.com"]);
});

test("keeps invalid entries so the API can report them", () => {
  assert.deepEqual(parseUrlList("not a url\nhttps://ok.com"), ["not a url", "https://ok.com"]);
});
