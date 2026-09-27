import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError } from "../lib/errors.js";
import { validateUrls } from "./url-validator.js";

test("validateUrls normalises and removes duplicates", () => {
  assert.deepEqual(validateUrls(["https://a.com", "https://A.com/", "https://a.com#top", "https://b.com"]), [
    "https://a.com/",
    "https://b.com/",
  ]);
});

test("validateUrls rejects the whole list with a 400 naming each invalid entry", () => {
  assert.throws(
    () => validateUrls(["https://ok.com", "ftp://x", "nope"]),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      Array.isArray(error.details) &&
      error.details.length === 2,
  );
});
