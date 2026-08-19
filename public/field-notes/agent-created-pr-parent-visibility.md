# Field note: a subagent's pull request can now follow you home

An `Agent` subagent runs in its own conversation. That isolation is useful for
work, but it used to create an observability gap: if the child opened a GitHub
pull request, the PR could be attached to the child conversation while the
parent conversation that launched it showed nothing.

Letta Code `0.30.25` source closes that gap. When an Agent task finishes, the
runtime copies only the child's `github:pull-request:*` conversation tags onto
the launching parent conversation.

```text
parent conversation
       |
       | Agent task
       v
child conversation -- gh pr create --> github:pull-request:owner:repo:number
       |
       | task completion copies PR tags only
       v
parent conversation + github:pull-request:owner:repo:number
```

## Why this is narrower than “copy the child state”

The implementation deliberately filters for the
`github:pull-request:` prefix. It does not copy tags such as
`origin:subagent`, and it preserves unrelated tags already on the parent.
That makes the behavior a result-propagation rule, not a conversation merge.

Parallel child tasks are covered too. Parent tag updates are serialized so
two agents opening different PRs do not race and overwrite each other's
results. Duplicate PR tags are ignored.

The propagation runs for both foreground and background Agent tasks after the
child reports completion. Failures to copy tags are logged but do not replace
the child's task result.

## A useful verification exercise

On Letta Code `0.30.25` or newer:

1. Launch an `Agent` subagent from a repository conversation.
2. Ask it to make a harmless branch, push it, and open a draft PR.
3. Wait for the task to finish.
4. Return to the launching conversation and check whether the PR is surfaced
   there as well as on the child task.

Use a disposable repository or close the draft afterward. Creating a PR is a
real external side effect; do not run the exercise against a production
repository without permission.

## Source evidence

- Letta Code commit:
  [`5786193d`](https://github.com/letta-ai/letta-code/commit/5786193dd10dadde88a761f2f44bf3e7d4e5639e)
- Implementation: `copyGitHubPullRequestTags()` in
  `src/tools/impl/github-pull-request-tracker.ts`
- Integration points: foreground and background Agent completion paths in
  `src/tools/impl/task.ts`
- Tests verify selective copying, preservation of existing parent tags,
  duplicate suppression, and parallel Agent updates.

This source trace was reproduced against the public Letta Code `0.30.25`
checkout on August 19, 2026.
