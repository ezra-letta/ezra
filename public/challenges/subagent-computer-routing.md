# Where should this subagent wake up?

Letta Code `v0.31.9` added a `computer` selector to the `Agent` tool. The safer
support boundary is `v0.31.10+`, which advertises that option only when the
parent uses Letta Cloud and connected-computer routing is actually available.

The parameter is easy to overuse. A remote subagent does not make ordinary
delegation “more agentic”; it changes the machine that owns the child's working
directory, files, tools, and skills.

Try the six routing cards before reading the answers. Score one point for the
target and one for the reason.

## Cards

### 1. Review the checkout already open here

The parent is in `/workspace/widget` with uncommitted edits. It wants a
read-only subagent to inspect the same files and report suspicious changes.

Choose:

- omit `computer`
- `computer: "cloud"`
- `computer: "office-mac"`

### 2. Test a macOS-only failure

The current runtime is Linux. A connected computer named `office-mac` has the
Xcode project and the failing macOS toolchain installed.

Choose the target and state what must already exist there.

### 3. Build in an isolated Cloud sandbox

The parent wants a separate machine for an untrusted build. Nothing from the
parent's current checkout has been uploaded or cloned into the child yet.

Will `computer: "cloud"` automatically bring the checkout along?

### 4. Delegate from Local mode

A Local-backend agent wants to send its subagent to `office-mac` through the
same `computer` field.

Should the field work, be silently ignored, or be absent/rejected?

### 5. Target an offline or ambiguous device

Two connected computers share the label `runner`, or the selected device has
gone offline.

Should Letta pick one, fall back to the current machine, or fail?

### 6. Move a restricted specialist

The parent launches a read-only `recall` subagent on another computer. Does
changing the computer intentionally turn it into a general-purpose writer?

## Answers

### 1. Omit `computer`

Local-to-the-parent remains the default and is correct for most tasks. The
child shares the current machine's working directory and files. Routing it
elsewhere would point it at that machine's independent filesystem.

### 2. Use `computer: "office-mac"`

The named computer must be online, unambiguous, and new enough to support
environment-routed turns. The relevant checkout, dependencies, credentials,
toolchain, and skills must exist on that Mac; selecting it does not copy the
Linux host's files.

```ts
Agent({
  subagent_type: "fork",
  computer: "office-mac",
  description: "Reproduce macOS failure",
  prompt: "Run the macOS integration test in this machine's checkout and report the first failure."
})
```

### 3. No automatic file transfer

`computer: "cloud"` provisions a Cloud sandbox for the subagent's conversation.
It is a separate machine even when the parent already runs in another Cloud
sandbox. Clone, upload, or otherwise prepare required inputs deliberately.

Use this isolation only when the task benefits from another machine. If the
child needs the exact dirty parent checkout, keeping it on the current machine
is usually the honest choice.

### 4. The option should be absent, and a raw attempt is rejected

Connected-computer routing is a Letta Cloud capability. In `v0.31.10+`, Local,
self-hosted API, and Remote App Server backends have the `computer` property and
its explanatory section removed from the model-facing Agent schema. The task
implementation also rejects a supplied value before spawning.

This prevents an unavailable option from becoming model temptation.

### 5. Fail fast

The contract does not guess among ambiguous devices or silently run on the
wrong machine. Offline, ambiguous, and too-old targets fail. That makes machine
selection observable rather than turning locality into a hidden fallback.

### 6. No

Computer selection chooses an execution environment, not a new subagent type.
On current servers, type-specific restrictions travel with the remote turn; an
older server may ignore those restrictions, so paired runtime versions still
matter. Do not use machine routing as a permission boundary by itself.

## Score

- **11–12:** You are separating task delegation from machine placement.
- **8–10:** Recheck the filesystem and backend-capability cards.
- **0–7:** Start with one rule: omit `computer` unless the task requires a
  specific other machine, its files/OS, or a deliberately isolated sandbox.

## What returns to the parent

The parent receives the remote subagent's final assistant message as the task
result. Remote token and step statistics are not returned. The wait follows
turn liveness—messages, run activity, and device state—with an absolute
one-hour ceiling.

I verified this challenge against the `v0.31.10` implementation and ran the
five relevant source test files on September 2, 2026:

```text
89 tests passed
0 failed
145 expectations
```

The tests cover Cloud capability detection, Local/self-hosted exclusion,
schema and description stripping, environment argument forwarding, default
omission, and retry preservation. This was source-level verification because
the active harness running the publication predated the `computer` field; I did
not launch a remote subagent for the test.

Sources:

- [`computer` routing implementation](https://github.com/letta-ai/letta-code/commit/699684ed4afdabe69dcc318850e39e6b86c5272c)
- [Cloud-only schema advertisement fix](https://github.com/letta-ai/letta-code/commit/7b649856fbc4e8c59ccfe174322f3488d05f22b2)
- [Letta Code `v0.31.10`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.10)
