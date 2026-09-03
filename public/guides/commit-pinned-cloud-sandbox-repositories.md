# Give a Cloud sandbox a coordinate, not a moving destination

A repository name answers **where** code lives. A Git commit answers **which
code** you mean.

Agent SDK `v0.8.3` lets an SDK-managed Cloud sandbox request both when cloning a
GitHub repository:

```ts
const session = client.resumeSession("conv-...", {
  sandbox: {
    githubRepositories: [
      {
        owner: "example-org",
        repo: "checkout-service",
        commit: "7d1d6351f6409459c6d5f5d92a3f53c42e9f6e7a"
      }
    ]
  }
});
```

Omit `commit` and the sandbox uses the repository's default-branch tip. Supply
it and the sandbox checks out that exact revision after cloning.

## The reproducibility equation

```text
repository only
  example-org/checkout-service
            +
  default branch at sandbox creation time
            =
  a moving input

repository + full commit SHA
  example-org/checkout-service
            +
  7d1d6351f6409459c6d5f5d92a3f53c42e9f6e7a
            =
  a named source snapshot
```

This matters when an agent is asked to reproduce a failure, review a release,
or compare outputs over time. “Run against `main`” can silently mean different
source on Monday and Thursday. A full commit gives the source half of the
experiment a stable coordinate.

It does **not** freeze everything. Reproducibility still depends on the model,
provider settings, system instructions, dependencies downloaded by the build,
external APIs, secrets, OS image, and runtime version. Pinning the repository is
one controlled variable, not a complete hermetic build.

## Choose moving or pinned inputs deliberately

### Use the default branch tip for continuous work

```ts
sandbox: {
  githubRepositories: [
    { owner: "example-org", repo: "checkout-service" }
  ]
}
```

This fits tasks such as “review the latest code” or “run today's smoke test.”
The movement is intentional.

### Use a commit for reproduction and audit

```ts
sandbox: {
  githubRepositories: [
    {
      owner: "example-org",
      repo: "checkout-service",
      commit: process.env.CHECKOUT_SERVICE_COMMIT
    }
  ]
}
```

Resolve and validate that environment value before opening the session. Record
the SHA beside the run or experiment result so another caller can request the
same source later.

### Mix policies repository by repository

The option supports up to ten repositories, and each entry chooses
independently:

```ts
githubRepositories: [
  // Product source must match the incident.
  {
    owner: "example-org",
    repo: "checkout-service",
    commit: "7d1d6351f6409459c6d5f5d92a3f53c42e9f6e7a"
  },
  // The living troubleshooting playbook should stay current.
  { owner: "example-org", repo: "operations-playbook" }
]
```

That is often more useful than pretending the whole task is either frozen or
live.

## Why a branch name is rejected

The SDK accepts exactly 40 hexadecimal characters for `commit`. These fail
before sandbox creation:

```ts
commit: "main"       // branch, not a commit identity
commit: "7d1d635"    // abbreviated SHA
commit: "v1.4.0"     // tag
```

Client-side validation reduces ambiguity and catches accidental branch-shaped
configuration early. Resolve a branch or tag to a full commit SHA in your
trusted control plane, then pass that immutable identity to the SDK.

For example, inside an already trusted local checkout:

```bash
git rev-parse HEAD
```

Do not interpolate untrusted webhook text into shell commands to resolve a
revision. Use a Git library or strict allowlist when revision selection comes
from external input.

## Scope and access boundaries

- This option configures repositories cloned into an **SDK-managed Cloud
  sandbox**, under `/root/workspace`.
- It is not a repository attachment to agent memory and does not make files
  part of MemFS.
- Private repositories still require access through the Letta organization's
  GitHub integration.
- `githubRepositories` cannot be combined with an explicit connected-computer
  selection because the SDK-managed sandbox is the clone owner.
- The SHA pins source selection; normal repository permissions and secret
  handling still apply.

## Verification record

On September 3, 2026, I verified commit
`c173f423ede1800bf94f7c3d35ef04c2d16094ce` as an ancestor of Agent SDK
`v0.8.3` and confirmed that the relevant source and tests match that tag. The
full Cloud session test file passed:

```text
47 tests passed
0 failed
216 expectations
```

The focused cases verify that the full SHA is forwarded in the sandbox-create
request while an unpinned repository remains unchanged, and that `"main"` is
rejected as an invalid commit. The suite uses Cloud fakes; I did not provision a
live sandbox or clone a private repository.

Sources:

- [Agent SDK `v0.8.3` release](https://github.com/letta-ai/letta-agent-sdk/releases/tag/v0.8.3)
- [Commit-pinned repository implementation](https://github.com/letta-ai/letta-agent-sdk/commit/c173f423ede1800bf94f7c3d35ef04c2d16094ce)
