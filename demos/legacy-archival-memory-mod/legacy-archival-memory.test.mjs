import assert from "node:assert/strict";
import test from "node:test";

import activate from "./legacy-archival-memory.mjs";

function harness(overrides = {}) {
  const registrations = new Map();
  const calls = [];
  const passages = {
    async search(agentId, params) {
      calls.push({ method: "search", agentId, params });
      return {
        count: 1,
        results: [
          {
            id: "passage-search",
            content: "Daily summary",
            tags: ["daily"],
            timestamp: "2026-08-11T00:00:00Z",
          },
        ],
      };
    },
    async list(agentId, params) {
      calls.push({ method: "list", agentId, params });
      return [
        {
          id: "passage-list",
          text: "Older note",
          tags: ["note"],
          created_at: "2026-08-10T00:00:00Z",
        },
      ];
    },
    async create(agentId, params) {
      calls.push({ method: "create", agentId, params });
      return [
        {
          id: "passage-new",
          text: params.text,
          tags: params.tags,
          created_at: params.created_at ?? "2026-08-12T00:00:00Z",
        },
      ];
    },
    ...overrides,
  };
  const client = { agents: { passages } };
  const letta = {
    capabilities: { tools: true },
    async getClient() {
      return client;
    },
    tools: {
      register(definition) {
        registrations.set(definition.name, definition);
        return () => registrations.delete(definition.name);
      },
    },
  };
  const dispose = activate(letta);
  return { calls, dispose, registrations };
}

function context(args = {}) {
  return {
    agent: { id: "agent-test", name: "Stella" },
    args,
    signal: new AbortController().signal,
  };
}

test("registers agent-scoped archive tools with safe approval defaults", () => {
  const { registrations, dispose } = harness();
  assert.deepEqual([...registrations.keys()], [
    "legacy_archival_memory_search",
    "legacy_archival_memory_list",
    "legacy_archival_memory_insert",
  ]);
  assert.equal(
    registrations.get("legacy_archival_memory_search").requiresApproval,
    false,
  );
  assert.equal(
    registrations.get("legacy_archival_memory_insert").requiresApproval,
    true,
  );
  dispose();
  assert.equal(registrations.size, 0);
});

test("searches only the active agent archive and normalizes results", async () => {
  const { calls, registrations } = harness();
  const result = await registrations
    .get("legacy_archival_memory_search")
    .run(
      context({
        query: "daily summary",
        tags: [" daily ", "daily", "work"],
        tag_match_mode: "all",
        top_k: 999,
      }),
    );

  assert.deepEqual(calls[0], {
    method: "search",
    agentId: "agent-test",
    params: {
      query: "daily summary",
      tags: ["daily", "work"],
      tag_match_mode: "all",
      top_k: 25,
    },
  });
  const parsed = JSON.parse(result);
  assert.equal(parsed.results[0].text, "Daily summary");
  assert.equal(parsed.results[0].created_at, "2026-08-11T00:00:00Z");
});

test("lists newest entries by default and returns a continuation ID", async () => {
  const { calls, registrations } = harness();
  const result = await registrations
    .get("legacy_archival_memory_list")
    .run(context({ search: "note" }));

  assert.deepEqual(calls[0], {
    method: "list",
    agentId: "agent-test",
    params: { ascending: false, limit: 25, search: "note" },
  });
  const parsed = JSON.parse(result);
  assert.deepEqual(parsed.continuation, { after: "passage-list" });
});

test("inserts into only the active agent archive", async () => {
  const { calls, registrations } = harness();
  const result = await registrations
    .get("legacy_archival_memory_insert")
    .run(
      context({
        text: "  New daily summary  ",
        tags: ["daily"],
        created_at: "2026-08-12T12:00:00Z",
      }),
    );

  assert.deepEqual(calls[0], {
    method: "create",
    agentId: "agent-test",
    params: {
      text: "New daily summary",
      tags: ["daily"],
      created_at: "2026-08-12T12:00:00Z",
    },
  });
  assert.equal(JSON.parse(result).inserted, 1);
});

test("returns a bounded authorization error instead of throwing", async () => {
  const error = Object.assign(new Error("secret backend detail"), {
    status: 403,
  });
  const { registrations } = harness({
    async search() {
      throw error;
    },
  });
  const result = await registrations
    .get("legacy_archival_memory_search")
    .run(context({ query: "anything" }));

  assert.equal(result.status, "error");
  assert.match(result.content, /not authorized/);
  assert.doesNotMatch(result.content, /secret backend detail/);
});

test("fails locally when no active agent ID is available", async () => {
  const { calls, registrations } = harness();
  const ctx = context({ query: "anything" });
  ctx.agent.id = null;
  const result = await registrations
    .get("legacy_archival_memory_search")
    .run(ctx);

  assert.equal(result.status, "error");
  assert.equal(result.content, "active agent ID is required");
  assert.equal(calls.length, 0);
});

test("does not expose arbitrary backend error text", async () => {
  const { registrations } = harness({
    async list() {
      throw Object.assign(
        new Error("https://private.example/tenant/secret returned credential abc"),
        { status: 400 },
      );
    },
  });
  const result = await registrations
    .get("legacy_archival_memory_list")
    .run(context());

  assert.equal(result.status, "error");
  assert.match(result.content, /request failed/);
  assert.doesNotMatch(result.content, /private|credential|secret/);
});
