# Memory placement decision framework

Use this when deciding where a fact, rule, note, or document belongs.

## The four gates for `system/`

Pin content only when it passes all four gates:

1. **Always-needed** — relevant to most turns, not just a current project branch or one debugging session.
2. **Durable** — expected to stay true beyond the current session.
3. **Concise** — can be represented as a short rule, summary, or pointer.
4. **Behavior-changing** — the agent would act worse if this were absent.

If any gate fails, do not pin the full content. Store it outside `system/` and add a pointer if discoverability matters.

## Placement table

| Content type | Best location | Notes |
|---|---|---|
| Agent identity, role, principles | `system/persona/` | Keep stable and short |
| Stable user preferences | `system/human/` | Only stable preferences, not full history |
| Project commands used constantly | `system/project/commands.md` | Keep as command summary; details outside |
| API docs, SDK references | `reference/` | Link from a pinned index |
| Debug traces and logs | `logs/` or `troubleshooting/` | Never pin raw logs |
| Dynamic status / queues | outside `system/` | Read on demand |
| Reusable workflows | `patterns/` or skill `references/` | Pin only a pointer |
| Skills | `skills/<name>/` | Use memfs skills when they should travel with the agent |
| Temporary plans | `projects/<name>/` or not saved | Promote only if reusable |

## Split pattern

When something feels important but too large:

1. Put the durable rule in `system/`.
2. Put details in `reference/`, `projects/`, or `patterns/`.
3. Link from pinned context:

```markdown
For provider-specific model gotchas, read [[reference/models/provider-gotchas.md]] before changing model configuration.
```

## Common mistakes

- Pinning everything because it feels important today.
- Pinning current task state that changes every few turns.
- Creating one large file per category instead of focused files.
- Forgetting discoverability: useful on-demand files need pointers.
- Assuming old memory is correct without re-verifying docs/API/source.

## Audit prompt

Ask:

> If this disappeared from `system/`, would I still know to read the right on-demand file when needed?

If yes, the full content probably does not need to be pinned.
