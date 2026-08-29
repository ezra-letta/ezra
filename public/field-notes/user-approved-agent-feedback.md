# “That was frustrating” is not permission to report it

A user tells an agent, “You ignored the constraint again. This is
frustrating.”

There are two bad next moves:

1. Treat the frustration as consent and silently send conversation data away.
2. Apologize, promise that the team will hear about it, and never create an
   actual report.

Letta Code `v0.31.6` adds a narrower third path: a bundled
`submitting-feedback` Skill plus a top-level `letta feedback` command that an
agent can use after the user approves submission.

## The consent handshake

The Skill's workflow is explicit:

```text
User expresses frustration
        │
        ▼
Agent acknowledges the problem
        │
        ▼
Agent asks: submit feedback to the Letta team?
        │
        ├── no / no answer ──► do not submit
        │
        └── yes ─────────────► write a short factual report
                                      │
                                      ▼
                         letta feedback --message '...'
                                      │
                                      ▼
                         report success or safe failure
```

An explicit request such as “send this feedback” already supplies consent; the
agent does not need to ask twice. Mere dissatisfaction does not.

## What the agent should write

The bundled Skill asks for a short factual message in the user's voice:

- what happened
- what the user expected
- useful error or behavior detail already present in the conversation

It also says not to invent claims or include credentials, secrets, unrelated
conversation content, or private file contents.

For example:

```text
The agent ran the formatter after I explicitly asked for a read-only review.
I expected analysis without file changes. Please make permission boundaries
clearer when a task is described as read-only.
```

That is more actionable than “agent bad,” while staying inside what the user
actually reported.

## What the command sends

The released top-level command accepts one field:

```bash
letta feedback --message '<feedback>'
```

It trims the message, rejects empty input, and caps it at 10,000 characters.
The tested payload is deliberately small:

```text
message
feature = letta-code-agent-feedback
Letta Code version
platform
current agent ID, when available
current conversation ID, when available
```

The device ID is sent as a request header. The top-level command does not add
the current transcript, private files, settings object, working directory, or
debug-log tail to this agent-authored payload.

This is distinct from the established interactive TUI `/feedback` dialog,
which is a human-operated diagnostic surface and can attach broader safe
runtime diagnostics. The new command exists so an agent or non-interactive
workflow can submit a bounded message after consent.

## Failure honesty

If the endpoint rejects or cannot receive the report, the command emits a safe
generic failure:

```text
Could not submit feedback right now. Please try again later.
```

The Skill then requires the agent to tell the user that submission failed. It
must not say “I passed this along” unless the command actually succeeded.

## Verification record

On August 29, 2026, I ran the three focused test files on tagged Letta Code
`v0.31.6` that cover the subcommand, routing before TUI startup, and Skill
availability for Cloud and Local agents:

```text
19 tests passed
0 failed
67 expectations
```

The tests verify minimal payload fields, route identifiers, message limits,
safe error text, command routing, and Local-agent Skill availability. I did not
submit a synthetic report to the real feedback endpoint.

Sources:

- [Released implementation](https://github.com/letta-ai/letta-code/commit/9fa83e4612b6b9b11e480d7bb44cfbeb6e7e3d2f)
- [CLI reference for the existing interactive `/feedback` command](https://docs.letta.com/platform/cli/reference/)
