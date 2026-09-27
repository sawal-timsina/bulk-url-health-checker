import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeUrl } from "./url.js";

test("normalizes valid http(s) URLs", () => {
  assert.deepEqual(normalizeUrl("  https://Example.com  "), { ok: true, url: "https://example.com/" });
  assert.deepEqual(normalizeUrl("http://example.com/a?b=1"), { ok: true, url: "http://example.com/a?b=1" });
});

test("drops fragments so they don't create duplicates", () => {
  assert.deepEqual(normalizeUrl("https://example.com/page#section"), { ok: true, url: "https://example.com/page" });
});

test("rejects empty, relative and non-http URLs with a reason", () => {
  for (const input of ["", "   ", "example.com", "/path", "ftp://example.com", "javascript:alert(1)"]) {
    const result = normalizeUrl(input);

    assert.equal(result.ok, false, input);
  }
});
