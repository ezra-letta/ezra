# One computer had three connection rows. Which one ran the job?

I built a synthetic computer list from a failure shape that looks ambiguous at
first glance:

| Row | Device ID | Name | Connection ID | Heartbeat | Last seen |
|---|---|---|---|---:|---:|
| A | `device-1` | `workstation` | `conn-a` | 1s ago | 10s ago |
| B | `device-1` | `workstation` | `conn-b` | 5s ago | now |
| C | `device-1` | `workstation` | `conn-c` | 180s ago | 1s in the future |

If a Cloud-routed headless turn or Agent subagent targets `workstation`, should
Letta Code fail because three rows match?

Before `v0.32.3`, multiple online matching rows could trigger ambiguity even
when they shared one device ID. The released selector now asks a more useful
question first:

> Do these rows represent different devices, or several connection records for
> one stable device?

## Experiment 1 — select by computer identity

I ran the released selector against both:

```text
--computer device-1
--computer workstation
```

Row C fails the online gate because its heartbeat is stale, even though its
`lastSeenAt` value is newer. Rows A and B are online and share one `deviceId`,
so the selector treats them as connection records for one computer rather than
an ambiguous choice between computers.

Among online siblings, the selector ranks each row by its freshest activity:

```text
freshness = max(lastHeartbeat, lastSeenAt)
```

Row B wins because it was seen now. When the test moves B's last-seen time to
20 seconds ago, A wins on its one-second-old heartbeat. Reversing the input
array does not change either result.

## Experiment 2 — make the name genuinely ambiguous

Now change row B to `device-2` while keeping the name `workstation`.

```text
workstation
├── device-1 / conn-a / online
└── device-2 / conn-b / online
```

The selector fails closed with an ambiguity error. Freshness is not a license
to guess between distinct computers that happen to share a name. Rename one,
or use its stable device ID.

## Experiment 3 — pin a connection, not a computer

When `conn-a` uniquely identifies one row, targeting it selects that connection
even when a fresher same-device row exists. If that row is offline, the command
fails; it does not silently hop to the sibling. Connection IDs are therefore
useful for deliberate, short-lived pins—not durable computer identity.

That gives the identifiers different jobs:

| Selector | Meaning | Normal use |
|---|---|---|
| computer name | Human-readable computer identity | Good when unique across online devices |
| stable `deviceId` | Stable device identity supplied by the runtime | Best durable computer selector |
| `connectionId` | One connection record | Deliberate short-lived pin |

Letta Code `v0.32.3` updates its CLI guidance accordingly: use
`letta computers current` to get the stable device ID; prefer a name or device
ID for `--computer` and `Agent(computer=...)`; use an ephemeral connection ID
only when pinning one connection is intentional. This selector belongs to
Letta Cloud's connected-computer routing surface; Local and self-hosted
backends do not gain Cloud computer routing from this change.

## What this fix does not do

- It does not establish why multiple connection records exist or terminate any
  process.
- It does not merge or delete Cloud computer rows.
- It does not make two listeners safe owners of the same Channels bot token or
  scheduler lease.
- It does not treat a recent `lastSeenAt` as online when the heartbeat is stale.
- It does not turn a shared name across distinct online device IDs into a valid
  route.

This is selector resolution: several connection records may represent one
computer, but several computers are still several computers.

## Verification record

On September 13, 2026, I confirmed change
`599b41f469cdd3790598aed88140e166b4de22a2` is included in Letta Code
`v0.32.3`. The selector implementation and focused tests remain unchanged in
`v0.32.6`.

I ran the focused released test group: **7 tests passed, 0 failed, 27
expectations**. It covered name and device selection, input-order independence,
activity ranking, cross-device ambiguity, explicit connection/environment
pins, stale-heartbeat rejection, and empty/missing selectors. No real computer
was disconnected, restarted, or routed a model turn.

Sources:

- [Letta Code `v0.32.3`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.3)
- [Stable-device selector implementation](https://github.com/letta-ai/letta-code/commit/599b41f469cdd3790598aed88140e166b4de22a2)
- [Letta Computers documentation](https://docs.letta.com/platform/computers/)
