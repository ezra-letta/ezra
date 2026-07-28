# Cron + Channels route doctor for Letta Code

A read-only diagnostic that inspects cron and channel routing configuration
to find silent misconfiguration that causes cron-fired sessions to lose
`MessageChannel` tool scope.

- **Check A** — schedule `conversation_id` vs `routing.yaml` `conversationId` mismatch
- **Check B** — `scheduler_owner` process liveness / drift
- **Check C** — multiple Letta runtime processes (risk, not proof)
- **Check D** — channel adapter running state is process-local (limitation)

The doctor **never writes, edits, or modifies any file**. It never prints
secrets, tokens, fingerprints, or account credentials. It does not read
`accounts.json`. It reads only `crons.json` and `routing.yaml` and reports
findings with explicit evidence levels and per-task OK/INCONCLUSIVE/CRITICAL
status.

## Run it

```bash
git clone https://github.com/ezra-letta/ezra.git
cd ezra/demos/cron-channels-route-doctor
npm test     # run the test suite (63 tests, zero dependencies)
npm start    # run the doctor against your live ~/.letta
```

For a support-ready JSON packet:

```bash
npm run --silent start -- --json > doctor-report.json
```

Inspect the file before sharing it. The doctor redacts home directory paths,
but channel names, route counts, and conversation ID prefixes (`conv-xxx`)
are included.

## Path resolution: LETTA_HOME vs os.homedir()

The doctor mirrors a critical split in the Letta Code runtime:

| File | Root resolution | Source |
| --- | --- | --- |
| `crons.json` | Honors `LETTA_HOME`, falls back to `HOME`/`USERPROFILE` + `.letta` | `src/cron/cron-file.ts`: `getLettaDir` |
| `channels/<channel>/routing.yaml` | Always `os.homedir()/.letta/channels` — does NOT honor `LETTA_HOME` | `src/channels/config.ts`: `CHANNELS_ROOT` |

This means if you set `LETTA_HOME` to a custom directory, your crons will
be read from there, but your channel routing files will still be read from
`~/.letta/channels`. This split is a common source of confusion and is
documented by the doctor in every report.

For tests, `channelsRootOverride` is supported to point channel file reads
at a temp directory.

## How to interpret it

### Evidence levels

Every finding carries an evidence level:

| Level | Meaning |
| --- | --- |
| **confirmed** | Direct file or process evidence proves the finding. |
| **likely** | Strong circumstantial evidence from heuristic pattern matching. |
| **inconclusive** | Data is missing or ambiguous. Cannot determine from files alone. |
| **limitation** | Inherent design boundary. Cannot be proven from files at all. |

### Per-task status

Check A emits an explicit `taskStatus` for every active cron task:

| Status | Meaning |
| --- | --- |
| **OK** | A matching, enabled, outbound-enabled route exists. MessageChannel should be in scope. |
| **INCONCLUSIVE** | `conversation_id` is `"new"`; it creates a conversation that cannot have a preexisting route, but the doctor does not know whether channel delivery was intended. |
| **CRITICAL** | No matching route, route disabled, or all routes have `outboundEnabled: false`. MessageChannel will be absent. |

Silence is never a clean bill of health — every active task gets a finding.

### Check A — conversation mismatch (confirmed)

Compares each active cron task's `conversation_id` against all
`route.conversationId` values in every channel's `routing.yaml`.

The route resolver in `src/tools/toolset.ts`
(`resolveConversationChannelToolScope`) does exact string match AND filters
out routes where `outboundEnabled === false`. If no route passes ALL filters
(`agentId`, `conversationId`, `enabled`, `outboundEnabled`), the `channels`
array is empty and `MessageChannel` is absent from the tool scope entirely.

Key behaviors from `src/cron/scheduler.ts` (`resolveCronFireConversationId`):

- **`"new"`**: Creates a fresh conversation per fire. The new conversation ID
  cannot match any preexisting route. This is by design, not a mismatch.
- **`"default"`**: Resolves to `undefined` in `resolveCronFireConversationId`,
  then `prepareToolExecutionContext` normalizes the missing ID to the literal
  `"default"` scope before route matching. It therefore requires an exact
  route whose `conversationId` is also `"default"`.
- **Specific ID**: Used as-is for exact string match against route entries.
- **Disabled routes**: A route exists but `enabled: false` → no match.
- **`outboundEnabled: false`**: Route is excluded from tool scope entirely —
  `MessageChannel` is **absent**, not just blocked from sending. This is
  confirmed behavior from `src/tools/toolset.ts`.

### Check B — scheduler_owner liveness (confirmed)

Reads `crons.json.scheduler_owner` and checks if the PID is alive using
`process.kill(pid, 0)` (cross-platform). On Linux, also compares
`process_start_ticks` and `boot_id` for drift detection (same PID, different
process after container restart). Mirrors `src/cron/cron-file.ts`:
`isProcessAlive`.

The doctor **never includes `scheduler_owner.token`** or any fingerprints in
the report. Only `pid` and `started_at` are reported.

### Check C — multiple runtimes (likely)

Scans the process table for Letta runtime processes using platform-appropriate
commands:

- **Unix**: `ps -axo pid=,ppid=,command=`
- **Windows**: PowerShell `Get-CimInstance Win32_Process | ConvertTo-Json`

Classification:

| Role | Meaning |
| --- | --- |
| `explicit-channel-runtime` | Command has `--channels` flag |
| `remote-runtime-candidate` | Command looks like a Letta runtime but no `--channels` |

Multiple runtimes are a **risk**, never proof of a problem. Parent/child
runtime processes are **not** automatically duplicates; supervised runtime
trees can be valid.

The doctor correlates the `scheduler_owner` PID with detected runtimes to
determine whether the lease holder is among them.

If the scan fails (command unavailable, timeout), the check returns
**inconclusive** rather than reporting "no listeners."

### Check D — adapter state limitation (limitation)

Always reported. The doctor can read `routing.yaml` and `crons.json`, but it
**cannot determine whether a channel adapter is `isRunning()` in the process
that will fire a cron task**. `isRunning()` (src/channels/types.ts:
`ChannelAdapter.isRunning`) is a per-process in-memory registry check with no
cross-process IPC. Even if routes are enabled and conversation IDs match, the
adapter may not be running in the cron-firing process.

## File format handling

### crons.json

The doctor distinguishes four file states:

| Status | Meaning |
| --- | --- |
| `ok` | File exists, valid JSON, version 1 |
| `missing` | File does not exist |
| `invalid-json` | File exists but JSON.parse failed |
| `unsupported-version` | File exists, valid JSON, but version ≠ 1 |

### routing.yaml

Despite the `.yaml` extension, Letta Code stores routing as JSON
(`src/channels/routing.ts`: `loadRoutes` does `JSON.parse(text)`). The runtime
does **not** fall back to YAML parsing — if `JSON.parse` fails, it silently
starts with an empty route table. The doctor reports invalid JSON explicitly.

| Status | Meaning |
| --- | --- |
| `ok` | File exists, valid JSON with `routes` array |
| `missing` | File does not exist |
| `invalid-json` | File exists but JSON.parse failed (corrupted) |
| `unsupported-version` | File exists, valid JSON, but no `routes` key |

## Recommended actions

The doctor **never recommends kill, hand-editing, or curl workarounds**.
All recommendations are read-only or use supported CLI/UI commands:

- `letta channels status` — inspect channel configuration and routing state
- `letta channels route list` — view the routing table
- `letta channels route add` — add a route (supported CLI command)
- `letta cron delete` / `letta cron add` — recreate a cron with the correct
  conversation ID
- Preserve logs and configuration before making changes
- Clean single-runtime restart only after evidence capture

## Privacy and safety

- The doctor replaces home directory paths with `~`.
- It **never** includes `scheduler_owner.token`, fingerprints, or any
  token-like strings in the report.
- It **never** reads `accounts.json`.
- It is read-only — it does not create, modify, or delete any files.
- It runs `ps` (Unix) or PowerShell (Windows) with a timeout for the process
  scan. No other external commands are executed.
- Read the JSON report before posting it publicly. Channel names, route
  counts, and conversation ID prefixes can reveal project information.

## Source references

The diagnostic logic is based on the following Letta Code source symbols
(cited by name, not line numbers, as they shift between versions):

- `src/cron/cron-file.ts` — `CronFileData`, `SchedulerOwner`,
  `readCronFile`, `claimSchedulerLease`, `isProcessAlive`,
  `readLinuxProcessIdentity`, `getLettaDir`, `getCronFilePath`
- `src/cron/scheduler.ts` — `fireCronTask`, `resolveCronFireConversationId`,
  `NEW_CONVERSATION_TARGET`
- `src/channels/routing.ts` — `loadRoutes`, `getRoutesForChannel`,
  `getAllRoutes`, `saveRoutes`
- `src/channels/config.ts` — `getChannelsRoot`, `getChannelRoutingPath`,
  `CHANNELS_ROOT`, `__testOverrideChannelsRoot`
- `src/channels/types.ts` — `ChannelRoute`, `ChannelAdapter.isRunning()`
- `src/tools/toolset.ts` — `resolveConversationChannelToolScope`
- `src/cli/subcommands/channels.ts` — `handleStatus`, `handleRouteList`

Verified against Letta Code source at version 0.28.13+ (package.json 0.29.4).
