import assert from "node:assert/strict";
import { test } from "node:test";
import { isTransientHttpStatus, isTransientNetworkError } from "./transient.js";

function fetchFailed(code: string) {
  return new TypeError("fetch failed", { cause: Object.assign(new Error(code), { code }) });
}

test("retries throttling and server errors, not client errors", () => {
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(isTransientHttpStatus(status), true, String(status));
  }

  for (const status of [200, 301, 400, 401, 403, 404, 410, 501]) {
    assert.equal(isTransientHttpStatus(status), false, String(status));
  }
});

test("retries timeouts and connection errors", () => {
  assert.equal(isTransientNetworkError(new DOMException("timed out", "TimeoutError")), true);
  assert.equal(isTransientNetworkError(fetchFailed("ECONNRESET")), true);
  assert.equal(isTransientNetworkError(fetchFailed("ECONNREFUSED")), true);
});

test("doesn't retry failures that won't fix themselves", () => {
  assert.equal(isTransientNetworkError(fetchFailed("ENOTFOUND")), false);
  assert.equal(isTransientNetworkError(fetchFailed("CERT_HAS_EXPIRED")), false);
  assert.equal(isTransientNetworkError(new Error("bug")), false);
  assert.equal(isTransientNetworkError("not an error"), false);
});
