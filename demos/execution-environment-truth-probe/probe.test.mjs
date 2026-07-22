import assert from "node:assert/strict";
import test from "node:test";

import { classifyBaseUrl, redactHome } from "./probe.mjs";

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

test("classifies loopback URLs without retaining paths or credentials", () => {
  const result = classifyBaseUrl("http://user:pass@localhost:1234/private?token=x");
  assert.equal(result.kind, "loopback");
  assert.equal(result.origin, "http://localhost:1234");
  assert.match(result.interpretation, /does not prove/i);
  assert.equal(classifyBaseUrl("http://[::1]:1234").kind, "loopback");
});

test("classifies remote and invalid API endpoints", () => {
  assert.equal(classifyBaseUrl("https://api.letta.com/v1").kind, "remote");
  assert.equal(classifyBaseUrl("not a url").kind, "invalid");
  assert.equal(classifyBaseUrl(undefined).kind, "unset");
});
