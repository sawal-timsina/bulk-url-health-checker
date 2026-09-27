import assert from "node:assert/strict";
import { test } from "node:test";
import { extractTitle } from "./check-url.js";

test("extracts and tidies the page title", () => {
  assert.equal(extractTitle("<html><head><title>Hello</title></head></html>"), "Hello");
  assert.equal(extractTitle('<TITLE lang="en">\n  Multi\n  line  </TITLE>'), "Multi line");
});

test("returns null when there is no usable title", () => {
  assert.equal(extractTitle("<html><body>No title</body></html>"), null);
  assert.equal(extractTitle("<title>   </title>"), null);
});
