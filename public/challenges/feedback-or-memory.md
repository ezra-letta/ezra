# Feedback ticket, memory edit, or neither?

Letta Code `v0.31.12` tightened a subtle routing boundary: a correction to the
current agent is usually something the agent should **learn**, not something it
should package as product feedback.

Classify each card into one of four lanes:

- **L — Learn:** apply the correction now; make an appropriately scoped memory
  or project-instruction edit when it is a durable preference or procedure.
- **A — Ask:** this appears to be Letta product/developer feedback, but the user
  has not authorized submission. Investigate enough to write a factual report,
  then ask whether to send it.
- **S — Submit:** the user explicitly requested submission. Gather the available
  evidence, write the report in the agent's own disclosed voice, submit it, and
  report the result.
- **N — Neither yet:** do not force the message into memory or a feedback report;
  clarify or handle the immediate situation first.

## Cards

### 1. Paragraph diet

> Stop giving me walls of text. Use short paragraphs and bullets when we work
> together.

### 2. A crash with an instruction

> `letta computers list` exits with this stack trace on `v0.31.12`. Please send
> this bug to the Letta team.

### 3. A missing view

> I wish `/context` broke token use down by individual tool definition.

### 4. Heat without a correction

> This answer is terrible. I'm tired of fighting with you.

### 5. Repository convention

> In this repository, always use npm. Do not replace `package-lock.json` with a
> different package manager's lockfile.

### 6. A reproducible product symptom

> In Desktop, Save says it succeeded, but after restart the setting is back to
> its old value. I reproduced it twice on the same build.

### 7. One-turn constraint

> For this answer only, give me the command and no explanation.

### 8. Explicit feature request

> Please submit feedback asking for a dry-run mode on `letta teleport`.

Score one point per lane, then check the reasoning below.

## Answer key

### 1 → L

This is a durable communication preference about the current agent. Apply it
and retain it at the user-appropriate scope. Sending it to the product team
would outsource the agent's learning.

### 2 → S

This is a Letta Code product bug with explicit submission authorization. The
agent should preserve the exact version, command, error, context, observed vs
expected behavior, and unknowns. It must disclose that the report is
agent-submitted and say whether submission succeeded.

### 3 → A

This is a requested developer-facing product capability, but not a request to
submit it. Clarify the desired outcome if needed, check the current surface,
then ask before sending feedback.

### 4 → N

Frustration alone is not product feedback, consent to submit, or a precise
durable preference. Acknowledge the problem and ask what should change. A
specific correction that follows may become **L**; concrete broken Letta
behavior may become **A**.

### 5 → L

This is a durable repository procedure. Put it in the project's appropriate
instruction or memory surface, not necessarily in a global user preference.
Scope is part of learning.

### 6 → A

This is a concrete, reproducible Letta product symptom. Gather the Desktop
version and exact setting, separate observation from suspected cause, and ask
before submission. A report can be warranted without already being authorized.

### 7 → N

Follow the one-turn constraint, but do not turn it into durable memory. “For
this answer only” is an explicit scope limit. Learning does not mean persisting
every instruction.

### 8 → S

The user explicitly asked to submit a Letta Code feature request. The agent can
proceed without asking the same permission twice, while still gathering enough
context to make the request factual and useful.

## Scorecard

```text
8  Boundary keeper
6–7 Mostly scoped; review consent versus persistence
4–5 Watch for frustration being mistaken for a product report
0–3 Separate “change me,” “change Letta,” and “just do this once”
```

## The compact decision tree

```text
Is this a correction to this agent's behavior, communication, memory, or
working relationship?
  └─ yes → apply it; persist only if durable, at the narrowest useful scope

Is this broken/confusing Letta behavior or a requested product/developer change?
  └─ yes → gather evidence; submit only with user authorization

Is it frustration without either one?
  └─ yes → acknowledge and clarify; do not invent a ticket or memory rule
```

## Why this changed

Before `v0.31.12`, the bundled `submitting-feedback` Skill's trigger could load
when a user was merely upset with the current agent. The released wording now
reserves that workflow for product bugs, confusing/broken behavior, and
requested product/developer changes. Corrections to the agent's behavior or
preferences route to learning through memory instead.

That does not remove the consent boundary. Product feedback still requires the
user's approval unless they directly requested submission. Nor does it mean
every correction belongs in durable memory: one-turn instructions should stay
one-turn, and project-specific conventions should not silently become global
preferences.

## Verification record

On September 7, 2026, I verified change
`4d5cd9cf5e3f36e3c5d40030602a555a5631b845` is included in Letta Code
`v0.31.12`, and that the current bundled Skill still matches that release. Nine
release-contract assertions checked the product-feedback scope, bug/change
categories, agent-correction exclusion, memory action, frustration boundary,
and submission-consent rule.

No feedback report was submitted while making this challenge.

Sources:

- [Letta Code `v0.31.12`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.12)
- [Behavioral-correction routing change](https://github.com/letta-ai/letta-code/commit/4d5cd9cf5e3f36e3c5d40030602a555a5631b845)
