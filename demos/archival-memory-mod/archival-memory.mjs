const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 25;
const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;

class InputError extends Error {}

function requiredString(value, name) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new InputError(`${name} is required`);
  return text;
}

function optionalString(value) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

function optionalTags(value) {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? [...new Set(tags)] : undefined;
}

function boundedInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function compactPassage(passage) {
  return {
    id: passage.id ?? null,
    text: passage.text ?? passage.content ?? "",
    tags: passage.tags ?? [],
    created_at: passage.created_at ?? passage.timestamp ?? null,
  };
}

function apiFailure(error) {
  if (error instanceof InputError) {
    return { status: "error", content: error.message };
  }
  if (error?.name === "AbortError") {
    return { status: "error", content: "Archival-memory request was cancelled." };
  }
  const status = Number(error?.status);
  if (status === 401 || status === 403) {
    return {
      status: "error",
      content:
        "The current runtime credential is not authorized to access this agent's archival memory.",
    };
  }
  if (status === 404) {
    return {
      status: "error",
      content:
        "The archival-memory endpoint or this agent's archive was not found. Confirm this is the original Cloud agent and that its archive still exists.",
    };
  }
  if (status === 429) {
    return {
      status: "error",
      content: "The archival-memory API is rate-limited. Retry later.",
    };
  }
  if (status >= 500) {
    return {
      status: "error",
      content: "The archival-memory service returned a temporary server error.",
    };
  }
  return {
    status: "error",
    content:
      "The archival-memory request failed. Inspect local mod diagnostics or the runtime logs for details.",
  };
}

async function getClient(letta) {
  const client =
    typeof letta.getClient === "function"
      ? await letta.getClient()
      : letta.client;
  if (!client?.agents?.passages) {
    throw new Error("The active Letta client does not expose agents.passages");
  }
  return client;
}

export default function activate(letta) {
  if (!letta.capabilities.tools) return;

  const disposers = [];

  disposers.push(
    letta.tools.register({
      name: "archival_memory_api_search",
      description:
        "Semantically search this agent's archival memory through the Letta API. Use this for facts, summaries, or records stored in the agent's archive rather than in MemFS.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Natural-language semantic search query.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional archival tags to filter by.",
          },
          tag_match_mode: {
            type: "string",
            enum: ["any", "all"],
            description: "Whether any or all supplied tags must match.",
          },
          top_k: {
            type: "integer",
            minimum: 1,
            maximum: MAX_SEARCH_LIMIT,
            description: `Maximum results to return (default ${DEFAULT_SEARCH_LIMIT}, max ${MAX_SEARCH_LIMIT}).`,
          },
          start_datetime: {
            type: "string",
            description: "Optional ISO-8601 lower time bound.",
          },
          end_datetime: {
            type: "string",
            description: "Optional ISO-8601 upper time bound.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      requiresApproval: false,
      parallelSafe: true,
      async run(ctx) {
        try {
          const agentId = requiredString(ctx.agent.id, "active agent ID");
          const query = requiredString(ctx.args.query, "query");
          const tags = optionalTags(ctx.args.tags);
          const tagMatchMode =
            ctx.args.tag_match_mode === "all" ? "all" : "any";
          const client = await getClient(letta);
          const response = await client.agents.passages.search(
            agentId,
            {
              query,
              top_k: boundedInteger(
                ctx.args.top_k,
                DEFAULT_SEARCH_LIMIT,
                MAX_SEARCH_LIMIT,
              ),
              ...(tags ? { tags, tag_match_mode: tagMatchMode } : {}),
              ...(optionalString(ctx.args.start_datetime)
                ? { start_datetime: optionalString(ctx.args.start_datetime) }
                : {}),
              ...(optionalString(ctx.args.end_datetime)
                ? { end_datetime: optionalString(ctx.args.end_datetime) }
                : {}),
            },
            { signal: ctx.signal },
          );

          return JSON.stringify(
            {
              count: response.count ?? response.results?.length ?? 0,
              results: (response.results ?? []).map(compactPassage),
            },
            null,
            2,
          );
        } catch (error) {
          return apiFailure(error);
        }
      },
    }),
  );

  disposers.push(
    letta.tools.register({
      name: "archival_memory_api_list",
      description:
        "List or text-filter this agent's archival-memory entries through the Letta API. Use this to browse, audit, or progressively export entries when semantic search is not enough.",
      parameters: {
        type: "object",
        properties: {
          search: {
            type: "string",
            description: "Optional text filter.",
          },
          after: {
            type: "string",
            description: "Optional passage ID to continue after.",
          },
          before: {
            type: "string",
            description: "Optional passage ID to stop before.",
          },
          ascending: {
            type: "boolean",
            description: "Oldest first when true; newest first when false.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: MAX_LIST_LIMIT,
            description: `Maximum entries to return (default ${DEFAULT_LIST_LIMIT}, max ${MAX_LIST_LIMIT}).`,
          },
        },
        additionalProperties: false,
      },
      requiresApproval: false,
      parallelSafe: true,
      async run(ctx) {
        try {
          const agentId = requiredString(ctx.agent.id, "active agent ID");
          const client = await getClient(letta);
          const passages = await client.agents.passages.list(
            agentId,
            {
              limit: boundedInteger(
                ctx.args.limit,
                DEFAULT_LIST_LIMIT,
                MAX_LIST_LIMIT,
              ),
              ascending:
                typeof ctx.args.ascending === "boolean"
                  ? ctx.args.ascending
                  : false,
              ...(optionalString(ctx.args.search)
                ? { search: optionalString(ctx.args.search) }
                : {}),
              ...(optionalString(ctx.args.after)
                ? { after: optionalString(ctx.args.after) }
                : {}),
              ...(optionalString(ctx.args.before)
                ? { before: optionalString(ctx.args.before) }
                : {}),
            },
            { signal: ctx.signal },
          );

          return JSON.stringify(
            {
              count: passages.length,
              entries: passages.map(compactPassage),
              continuation:
                passages.length > 0
                  ? { after: passages.at(-1)?.id ?? null }
                  : null,
            },
            null,
            2,
          );
        } catch (error) {
          return apiFailure(error);
        }
      },
    }),
  );

  disposers.push(
    letta.tools.register({
      name: "archival_memory_api_insert",
      description:
        "Append a new entry to this agent's archival memory through the Letta API. Prefer MemFS for new Letta Agent memory unless the user explicitly wants to continue using the archive.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text to store in archival memory.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags for later filtering.",
          },
          created_at: {
            type: "string",
            description: "Optional ISO-8601 creation timestamp.",
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
      requiresApproval: true,
      parallelSafe: false,
      async run(ctx) {
        try {
          const agentId = requiredString(ctx.agent.id, "active agent ID");
          const text = requiredString(ctx.args.text, "text");
          const tags = optionalTags(ctx.args.tags);
          const createdAt = optionalString(ctx.args.created_at);
          const client = await getClient(letta);
          const passages = await client.agents.passages.create(
            agentId,
            {
              text,
              ...(tags ? { tags } : {}),
              ...(createdAt ? { created_at: createdAt } : {}),
            },
            { signal: ctx.signal },
          );

          return JSON.stringify(
            {
              inserted: passages.length,
              entries: passages.map(compactPassage),
            },
            null,
            2,
          );
        } catch (error) {
          return apiFailure(error);
        }
      },
    }),
  );

  return () => {
    for (const dispose of disposers.reverse()) dispose();
  };
}
