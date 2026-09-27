import assert from "node:assert/strict";
import { test } from "node:test";
import { TransientHttpError } from "../checks/transient-http-error.js";
import { outcomeFromFailure, outcomeFromResponse } from "./outcome.js";

test("2xx and 3xx are healthy; other final statuses fail", () => {
  assert.equal(outcomeFromResponse({ httpStatus: 200, responseTimeMs: 5, title: "Hi" }).status, "success");
  assert.equal(outcomeFromResponse({ httpStatus: 304, responseTimeMs: 5, title: null }).status, "success");

  const notFound = outcomeFromResponse({ httpStatus: 404, responseTimeMs: 5, title: "Missing" });

  assert.deepEqual(notFound, {
    status: "failed",
    httpStatus: 404,
    responseTimeMs: 5,
    title: "Missing",
    error: "HTTP 404",
  });
});

test("an exhausted transient status keeps what was measured", () => {
  const outcome = outcomeFromFailure(new TransientHttpError("503", 503, 12, "Busy"), 4);

  assert.deepEqual(outcome, {
    status: "failed",
    httpStatus: 503,
    responseTimeMs: 12,
    title: "Busy",
    error: "HTTP 503 after 4 attempts",
  });
});

test("network failures record the error only", () => {
  assert.deepEqual(outcomeFromFailure(new Error("socket hang up"), 1), { status: "failed", error: "socket hang up" });
});
