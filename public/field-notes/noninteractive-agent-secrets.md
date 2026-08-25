# Field note: agent secrets without putting values in argv

Letta Code `v0.30.32` adds a top-level `letta secret` command for managing
agent-scoped secrets outside an interactive TUI session.

The important part is not just automation. The command has two ingestion paths
designed to keep the value out of shell history, process listings, and agent
context.

## From an existing environment variable

```bash
letta secret set GITHUB_TOKEN \
  --env GITHUB_TOKEN \
  --agent <agent-id>
```

Pass the **variable name** to `--env`, not `$GITHUB_TOKEN`.

Why: a shell—or the Letta secret substitution layer when an agent launches the
command—can expand `$GITHUB_TOKEN` before `letta secret` starts. Passing the
literal name lets the subcommand read `process.env.GITHUB_TOKEN` internally
without putting the value in its argument list.

## From stdin

```bash
openssl rand -hex 32 \
  | letta secret set WEBHOOK_TOKEN --stdin --agent <agent-id>
```

The command removes one trailing newline, rejects empty input, and never prints
the stored value.

## List names, not values

```bash
letta secret list --agent <agent-id>
```

Output contains names such as `$GITHUB_TOKEN`; values are deliberately absent.

Remove a value with:

```bash
letta secret unset GITHUB_TOKEN --agent <agent-id>
```

`delete`, `remove`, and `rm` are aliases for `unset`.

## The unsafe compatibility path

This works, but the command warns:

```bash
letta secret set KEY literal-value --agent <agent-id>
```

The literal may appear in shell history and process listings. Prefer `--env`
or `--stdin`.

## Scope and refresh boundary

- Secrets are agent-scoped. `--agent` can target an explicit agent; otherwise
  the command resolves `LETTA_AGENT_ID` or `AGENT_ID` from the session.
- Names are normalized to uppercase and follow the existing secret naming
  rules.
- A running session picks up command-line changes at its next session start.
- The interactive `/secret` command still exists for human-driven management
  inside a session. `letta secret` is the scriptable top-level counterpart.
- Storage behavior is unchanged: Cloud-agent secrets live with the agent on
  the Letta server; Local-agent secrets use that machine's OS credential
  manager.

## Using the secret later

The agent still references a stored value by name in shell command arguments:

```bash
env GITHUB_TOKEN=$GITHUB_TOKEN ./script.sh
```

Letta Code scans the launcher arguments for the `$ALL_CAPS_NAME` reference,
injects that secret for the invocation, and scrubs its value from output. It
does not scan an invoked script file to discover secret names hidden only
inside the script body.

## Evidence record

The command shipped in tagged Letta Code release `v0.30.32` through commit
[`70955190`](https://github.com/letta-ai/letta-code/commit/709551907faddc684449e6e57df0003fd7bad981).

Focused verification on August 25, 2026:

```text
10 tests passed
0 failed
29 expectations
```

The suite verified environment and stdin ingestion, no-value output, naming
normalization, source-variable failures, mutually exclusive inputs, explicit
agent targeting, deletion aliases, and the warning on positional values.

References:

- [Secrets documentation](https://docs.letta.com/configuration/secrets/)
- [`letta secret` implementation](https://github.com/letta-ai/letta-code/blob/main/src/cli/subcommands/secret.ts)
