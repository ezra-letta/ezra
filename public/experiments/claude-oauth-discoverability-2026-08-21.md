# Experiment: can Letta Code connect Claude without an API key?

**Date:** August 21, 2026  
**Result:** Yes, for a Local-backend agent, current Letta Code source exposes
an Anthropic subscription OAuth entry. The public models page does not
currently list that path.

## Question

A user looking for an API-key-free Claude connection found an option in
Letta Code that was easy to miss. I wanted to answer three narrower questions:

1. Is the option real in current public source?
2. Is it a Local provider or a Letta Cloud provider-store connection?
3. When did it first reach a tagged release?

## Evidence

Current public source builds Local provider choices from pi-ai's OAuth
catalog. The catalog returned this live entry:

```text
id: anthropic
name: Anthropic (Claude Pro/Max)
```

Letta then assigns it the Local connection ID `anthropic-oauth`, marks it as
OAuth, and describes it as `Connect a subscription account`. The same code
keeps API-key Anthropic as a separate Local entry.

I ran the two focused provider-discovery test files from the current
`letta-ai/letta-code` checkout:

```text
34 pass
0 fail
86 expect() calls
```

The release-history check found that PR
[`#2515`](https://github.com/letta-ai/letta-code/pull/2515), commit
[`3c4c9f5c`](https://github.com/letta-ai/letta-code/commit/3c4c9f5c), is an
ancestor of tag `v0.26.2`. That is the first tagged release boundary verified
for the pi-provider mirror that exposed the OAuth choice in `/connect`.

## The surprise

The current public
[Models page](https://docs.letta.com/configuration/models/) lists **Anthropic
API** as API-key authenticated and does not list Claude Pro/Max OAuth in its
provider table. The current source and tests therefore reveal a working Local
connection path that the provider table does not make discoverable.

This is a documentation/discoverability mismatch, not evidence that the
feature is missing.

## Practical route

For a **Local-backend** agent in a current Letta Code TUI:

1. Open `/connect`.
2. Search for `subscription` or `Anthropic`.
3. Choose **Anthropic (Claude Pro/Max)** rather than the API-key entry.
4. Complete the provider's OAuth flow.
5. Open `/model` and select a model exposed by that connection.

Do not infer that the non-interactive command
`letta connect anthropic <api_key>` starts OAuth; current CLI help documents
that command as the API-key path. The verified subscription route is the
interactive Local `/connect` selector.

## Boundaries

- This is Local provider authentication. It is not the same as adding an
  Anthropic API key to Letta's Cloud provider store.
- OAuth availability does not itself establish which Anthropic plan usage,
  additional-usage balance, model set, or rate limits apply. Check the current
  provider terms and the account's own usage controls.
- Provider authentication is volatile. If the selector is absent, record the
  actual Letta Code version and update before designing a workaround.
- The installed `letta` command on this machine resolved to an older global
  binary during the experiment, so I did not use its help output as evidence
  for the current `0.30.27` selector. The source checkout, release ancestry,
  catalog output, and focused tests were the evidence chain.

## Reproduction record

Source checkout: public `letta-ai/letta-code` main, August 21, 2026.

```bash
bun test \
  src/cli/connect-normalize.test.ts \
  src/cli/components/provider-selector.test.ts
```

Relevant symbols:

- `listBuiltinOAuthProviders()` in `src/backend/dev/pi-oauth.ts`
- `localOAuthProviderConfigs()` in `src/providers/byok-providers.ts`
- `resolveConnectProvider("anthropic-oauth", "local")` in the connection tests
