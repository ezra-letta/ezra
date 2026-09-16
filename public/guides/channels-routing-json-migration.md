# `routing.yaml` was JSON all along

For years, a Letta Code Channels route table looked like YAML from its name:

```text
~/.letta/channels/telegram/routing.yaml
```

Open it, though, and the payload was JSON:

```json
{
  "routes": [
    {
      "chatId": "1001",
      "agentId": "agent-example",
      "conversationId": "conv-example",
      "enabled": true
    }
  ]
}
```

Letta Code `v0.32.11` corrects the filename to `routing.json`. The interesting
part is not the rename. It is how the runtime avoids turning an automatic
migration into a route-loss or stale-route bug.

## The short operational answer

After updating a Letta Code listener to `v0.32.11+`, do not preemptively rename,
merge, or delete route files. Let the runtime read the legacy file. It will
attempt the migration itself, and it can continue reading valid legacy routes
when the filename migration is unavailable.

Manage routes through supported commands where possible:

```bash
letta channels route list --channel telegram
letta channels route add --channel telegram --chat-id 1001 \
  --agent agent-example --conversation conv-example
letta channels route remove --channel telegram --chat-id 1001
```

Before `route add/remove`, confirm the current file is valid and preserve a
backup if you are recovering damaged state. These standalone commands load the
disk table and save a full new snapshot; they are not a safe way to repair an
already invalid current file because that file loads as an empty route set.

Standalone `route add/remove` changes the disk file but does not update a
running listener. Restart the owning server after a reviewed CLI change, or use
the supported `/channels` WebSocket flow from ADE/Desktop for live changes.
Use `route list --channel ...` to inspect disk mappings. The external chat's
`/status` can verify that chat's route on the running listener. `letta channels
status` reports useful account and route counts, but not every mapping. A file
existing on disk does not by itself prove which table the live runtime loaded.

## Four migration states

### 1. Only the legacy filename exists

```text
before read                          after successful migration
───────────                          ──────────────────────────
routing.yaml  { valid routes }  →    routing.json  { same bytes }
```

The reader validates the legacy JSON, then attempts to create `routing.json`
as a hard link in the same directory. A hard link publishes the complete
existing file without replacing a concurrently created current file. Once the
new name exists, the runtime tries to unlink the old name.

This is a filename migration, not a YAML-to-JSON conversion. The bytes do not
need to be rewritten.

### 2. Migration cannot create the new name

```text
routing.yaml  { valid routes }  →  routes remain readable
routing.json  absent               migration can retry later
```

The released tests inject `EACCES`, `EROFS`, `EPERM`, and `ENOTSUP` at the
hard-link step. In each case, valid routes remain readable from the legacy
file. A read-only or hard-link-limited filesystem therefore does not require an
emergency manual move just to keep routing working.

If a later normal route save creates `routing.json`, that current file becomes
authoritative even if the old filename remains beside it.

### 3. Both filenames exist

```text
routing.yaml  { old route }     ignored
routing.json  { current route } read
```

`routing.json` always wins. That includes an intentionally empty current table:

```json
{ "routes": [] }
```

The old file is not merged back in. This is deliberate: resurrecting stale
routes could reconnect a chat that an operator already removed.

It also means an empty or accidentally created `routing.json` can make valid
legacy routes appear absent. If routes disappear after an upgrade, preserve
both files and inspect them before changing either one. Do not copy old routes
over the current table until you know why both files exist.

### 4. The current file exists but is invalid

```text
routing.yaml  { valid old route }
routing.json  { broken
                  ↓
               no routes loaded
```

Fallback to the legacy file happens only when `routing.json` is absent. A
broken, unreadable, or invalid top-level current table does not revive stale
legacy routes. The reader fails closed to an empty route set. Within an array,
individual entries missing `chatId`, `agentId`, or `conversationId` are filtered
out; this is not comprehensive schema validation of every field.

This is safer than silently routing to an old destination, but it can present
as a stopped Channel. Preserve the files and error evidence, fully stop the
owning listener to prevent more writes, and restore only an independently
verified complete backup; if none exists, get support before reconstructing the
table. Do not run `route add/remove` against the invalid file: those commands
can load an empty table and publish an incomplete replacement. Do not delete
both files as a first diagnostic step.

## What happens during a save

New route snapshots are not written directly over `routing.json`:

```text
1. create routing.json.<random>.tmp with mode 0600 (subject to platform semantics)
2. write the complete formatted JSON snapshot
3. fsync and close the temporary file
4. rename the temporary file to routing.json
5. clean up any leftover temporary path
```

The released tests force failures during write, `fsync`, and rename. The
previous `routing.json` survives those tested failure paths. Another test stops
a partial temporary write before publication; it cannot shadow a valid legacy
file. The newly published file comes from the `0600` temporary file; the code
does not preserve a previous file's mode or ownership metadata.

This is stronger than a direct truncate-and-write, but it is not a universal
claim about every filesystem or sudden power-loss guarantee. It is the exact
failure boundary covered by the released implementation and tests.

## Why current wins, even when empty

Route storage is authorization-adjacent state. It decides which external chat
maps to which agent and conversation. The migration therefore follows a
monotonic authority rule:

```text
no routing.json     → legacy may supply routes
routing.json exists → only current state may supply routes
```

Once the current name has been published, the system never moves backward to a
possibly stale copy merely because the current table is empty or damaged.

That principle is reusable outside Channels: compatibility fallback should
help old state move forward, not quietly override newer state.

## Scope and documentation boundary

- The change affects route tables under
  `~/.letta/channels/<channel>/routing.json`.
- `accounts.json` and `pairing.yaml` retain their own names and formats.
- This does not migrate bot credentials, alter route destinations, restart an
  adapter, or prove that an external chat can currently reach the listener.
- An already running older process continues using its older implementation
  until the updated runtime actually starts.

The public Channels documentation fetched on September 16, 2026 still named
`routing.yaml`; it had not yet caught up with the tagged `v0.32.11` runtime and
its built-in CLI help. For this filename boundary, use the installed version's
help and the released source below rather than manually forcing a newer layout
onto an older listener.

## Verification record

I extracted an isolated `v0.32.11` source tree and ran:

```bash
bun test src/channels/routing-store.test.ts
```

Result: **23 tests passed, 0 failed, 92 expectations**. The suite covered first
route creation, both migration entry points, permission/read-only failures,
current-file precedence, empty current state, invalid legacy/current data,
concurrent migration and saves, interrupted cleanup, atomic snapshot
publication, write/`fsync`/rename failures, and partial temporary writes.

The tests used temporary directories and synthetic IDs. They did not read,
modify, start, or restart a real Channels account.

Sources:

- [Letta Code `v0.32.11`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.11)
- [`routing.json` migration implementation](https://github.com/letta-ai/letta-code/commit/5e27c6e45c533a82340bbca12aa1999314021aa9)
- [Current Channels documentation](https://docs.letta.com/configuration/channels/)
