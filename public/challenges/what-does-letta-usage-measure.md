# What does `letta usage` actually measure?

Letta Code `v0.32.12` added a small credential-scoped command:

```bash
letta usage
```

Its Markdown output contains a plan label, a credit balance, quota buckets, and
reset timestamps. Those fields sit next to several other things developers
also call “usage”: session tokens, context-window occupancy, provider quota,
model availability, and billable dollars.

This challenge is about keeping those meters separate.

## The output card

Use this synthetic card for every question:

```text
# Letta usage overview
Current plan: example-plan

## Usage Credits (non-BYOK models)
* Balance: 63.5 credits

## Usage Quota (`letta/*` models)
* Bucket (full/high/medium/low/empty): high (daily: low)
* Quota Window End: 2026-09-20T00:00:00Z
* Daily Quota Window End: 2026-09-18T00:00:00Z
```

For each card below, choose **yes**, **no**, or **not enough information** before
opening the answer key.

## Cards

### 1. Dollars

The balance says `63.5 credits`. Does that establish that the account has
exactly US$63.50 available?

### 2. Percentages

The primary quota bucket is `high`. Can an automation safely turn that into
“at least 75% remains”?

### 3. BYOK

The daily `letta/*` bucket is `low`. Does that prove a connected BYOK provider
is almost out of quota too?

### 4. This conversation

Can this select one agent or conversation?

```bash
letta usage --agent agent-example
```

### 5. Session tokens

Does the account card reveal how many prompt, completion, cached, or reasoning
tokens the current interactive session used?

### 6. Missing daily metadata

Suppose the card instead says:

```text
daily: Unavailable
Daily Quota Window End: Unavailable
```

Does that mean the daily quota is empty?

### 7. Local backend

With Local selected, will bare `letta usage` authenticate to Cloud and print
the Cloud account card anyway?

### 8. Partial success

The credit lookup succeeds, but the quota lookup fails. Will the command print
the known balance followed by an unavailable quota section?

### 9. Model availability

The account has a non-empty credit balance and a `high` Letta quota bucket.
Does that guarantee every model in a remembered catalog is currently available
to this organization?

## Answer key

### 1. No — the displayed number is credits, not that many dollars

Credits are Letta's cost unit for resources. Consumption depends on the priced
resource or model. The command deliberately labels the number `credits` and
does not print a currency conversion. In the same tagged build, interactive
`/usage` separately derives a dollar estimate by dividing integer credits by
1,000; the current public pricing page describes credits as a cost unit but
does not publish that conversion as a general contract. Either way, 63.5
credits does not mean US$63.50. The top-level command also prints a negative
balance as supplied; consumers should not clamp or reinterpret it.

### 2. No — a bucket is categorical

The released API contract exposes `full`, `high`, `medium`, `low`, or `empty`.
It does not expose a percentage or request count through this command. Report
the bucket as-is. Any numeric threshold assigned to `high` would be invented.

### 3. No — this is not provider quota

The quota section is explicitly for `letta/*` model routes. BYOK requests go
through the connected provider account instead of consuming Letta credits, and
any applicable quota or billing is governed by that account or plan. `letta
usage` does not aggregate external provider plans.

### 4. No — unsupported arguments fail

`letta usage` is credential-scoped. It accepts only `-h` / `--help`; `--agent`, a
positional argument, or an unknown flag exits nonzero with a JSON error on
stderr. The command uses the current CLI authentication, not an agent selector.

The released command returns the balance and quota visible to the current
backend and CLI credentials. The tagged client does not establish a more
specific organization-versus-user ownership rule, so an agent should not
automatically attribute those values to another human talking to it.

### 5. No — use the interactive surface for session statistics

Top-level `letta usage` reports the plan, credit balance, and `letta/*` quota.
It does not include per-session token statistics. Interactive `/usage` is a
separate command that reports session usage such as steps and token categories.
`/context` is the separate context-window view.

### 6. No — unavailable is not empty

The formatter uses `Unavailable` when the optional daily bucket or reset field
is absent. That is missing data, not a zero value and not proof of exhaustion.
The primary bucket and quota-window timestamp remain separate fields.

### 7. No — Local returns a Local-specific answer

With the Local backend selected, bare `letta usage` returns:

```text
Running on local backend. Model usage requires BYOK.
```

It does so before account lookup. If the intent is to inspect the authenticated
Cloud account while the saved preference is Local, use the explicit released
surface:

```bash
letta --backend cloud usage
```

That does not change where a Local agent's state lives or turn provider usage
into Letta quota.

### 8. No — the command is all-or-error

Cloud balance and quota requests run together, but output is assembled only
after both succeed. If either lookup fails, the command exits nonzero and emits
a JSON error to stderr. Treat the account card as unavailable; do not infer
zero credits, empty quota, or partial success from missing stdout.

### 9. No — inspect the live model inventory separately

Credits and quota describe spending/allowance state, not catalog entitlement,
provider health, region support, or a specific model's availability. Use
`letta model list` and the active Models surface for the current inventory. A
positive meter is not a model-discovery API.

## The four-meter map

| Question | Surface | Scope |
|---|---|---|
| What plan, credits, and Letta quota do my current credentials expose? | `letta usage` | Current backend and CLI credentials |
| What did this interactive session consume? | `/usage` | Current CLI session |
| How full is this conversation's active context? | `/context` | Current conversation/context window |
| Which model handles are currently advertised? | `letta model list` | Active backend catalog |

These meters can affect the same workflow, but none is a substitute for the
others.

## Verification record

On September 17, 2026, I extracted Letta Code `v0.32.12` and ran:

```bash
bun test src/cli/subcommands/usage.test.ts
```

Result: **6 tests passed, 0 failed, 18 expectations**. They covered help before
account lookup, Local behavior with implicit and explicit Local selection,
and rejection of agent, positional, and unknown arguments.

I also ran one authenticated Cloud canary with the tagged source. A local
validator confirmed:

```text
exit_code: 0
headings: plan, credits, letta-tier quota
primary_bucket_valid: yes
daily_bucket_shape_valid: yes
window_fields_present: yes
sensitive_values_printed: no
```

The tagged command path initializes CLI authentication, then calls only the
balance and quota metadata readers; it contains no inference dispatch. The
canary invoked that path. Its actual plan, balance, bucket values, and
timestamps were withheld from the validator's printed output and this artifact.

Sources:

- [Letta Code `v0.32.12`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.12)
- [`letta usage` implementation](https://github.com/letta-ai/letta-code/commit/942d84928991e53569c70fe9774070a2fc08da12)
- [Current Letta pricing documentation](https://docs.letta.com/pricing/)
