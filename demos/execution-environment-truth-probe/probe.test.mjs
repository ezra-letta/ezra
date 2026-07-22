import assert from "node:assert/strict";
import test from "node:test";

import { redactHome } from "./probe.mjs";

test("redacts the home directory without rewriting unrelated prefixes", () => {
  assert.equal(redactHome("/Users/test/project", "/Users/test"), "~/project");
  assert.equal(redactHome("/Users/test", "/Users/test"), "~");
  assert.equal(redactHome("/Users/tester/project", "/Users/test"), "/Users/tester/project");
  assert.equal(
    redactHome("C:\\Users\\test\\project", "C:\\Users\\test"),
    "~\\project",
  );
  assert.equal(
    redactHome("C:\\Users\\tester\\project", "C:\\Users\\test"),
    "C:\\Users\\tester\\project",
  );
});
