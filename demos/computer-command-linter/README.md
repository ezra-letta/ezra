# Letta computer-command linter

Letta Code `v0.31.12` standardized its public remote-routing vocabulary on
**computers**. The previous environment spellings remain compatibility aliases,
but normal help now teaches:

```bash
letta computers list --online-only
letta computers current
letta -p --agent <agent-id> --computer office-mac "check the build"
letta server --computer-name office-mac
```

This zero-dependency, read-only linter finds the hidden compatibility spellings
in shell scripts, READMEs, runbooks, and CI snippets. It reports canonical
replacements without rewriting files.

## Requirements

- Node.js 20 or newer
- No Letta credentials or running Letta process

## Run the sample

```bash
cd demos/computer-command-linter
npm run lint:sample
```

Expected output:

```text
fixtures/legacy-commands.sh:5:1  letta environments  →  letta computers
fixtures/legacy-commands.sh:6:32  --environment  →  --computer
fixtures/legacy-commands.sh:7:14  --env-name  →  --computer-name
```

Findings intentionally exit with status `1`, which makes the command usable as
a CI check. Read/usage failures exit `2`; a clean scan exits `0`.

Scan one or more files:

```bash
node linter.mjs README.md scripts/deploy.sh
```

Scan stdin:

```bash
find docs scripts -type f -print0 \
  | xargs -0 cat \
  | node linter.mjs -
```

Machine-readable output:

```bash
node linter.mjs --json scripts/deploy.sh
```

## What it flags

| Compatibility spelling | Canonical `v0.31.12+` spelling |
|---|---|
| `letta environments ...` | `letta computers ...` |
| `letta envs ...` | `letta computers ...` |
| headless `--environment ...` | `--computer ...` |
| headless `--env ...` | `--computer ...` |
| `--env-name ...` | `--computer-name ...` |

This is vocabulary migration, not a behavior migration. Letta Code `v0.31.12`
still accepts the old forms for backwards compatibility. Existing scripts are
not suddenly broken; updating them aligns examples, logs, and operator language
with current help. The underlying Cloud API and internal type names may still
use environment terminology.

The linter deliberately does not edit files or execute any matched command.
Review each result because prose, quoted historical examples, or version-pinned
scripts may intentionally retain an old spelling.

`--env` also has unrelated current meanings in commands such as `letta secret`
and `letta mcp`. The linter reports it only on a Letta headless invocation that
also contains a selector such as `-p`, `--agent`, `--conversation`, or
`--from-agent`.

## Test

```bash
npm test
```

The suite covers all five compatibility spellings, canonical commands,
unrelated current `--env` flags, lookalike words, multiple findings per line,
human and JSON output, sample CLI execution, and exit-code boundaries.

## Verification record

On September 5, 2026, the demo passed eight tests. I also verified feature
commit `680cba4b009147c671f22a76e89109ca17ebc01a` is included in Letta Code
`v0.31.12` and ran three matching upstream test files: 35 tests passed with 299
expectations.

Sources:

- [Letta Code `v0.31.12`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.12)
- [Computer-vocabulary implementation](https://github.com/letta-ai/letta-code/commit/680cba4b009147c671f22a76e89109ca17ebc01a)

## Cleanup

The demo stores no state and writes no files. Remove the directory if it is no
longer needed.
