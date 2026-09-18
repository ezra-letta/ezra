# Run Letta Code without a system Node installation

Letta Code `v0.32.13` is the first stable release distributed as the `letta`
package on PyPI. The wheel installs the same `letta` CLI while carrying its own
Node runtime, native dependencies, skills, and runtime assets.

This smoke test proves the narrow claim on the current machine. It creates a
temporary Python virtual environment, installs an exact wheel from PyPI, hides
system Node and npm from `PATH`, and checks:

- the installed package and CLI versions
- `letta --help`
- the bundled Node executable
- the Python-installer update boundary
- a fresh HOME and an environment-variable allowlist that omits credentials

It never starts an interactive agent or makes an inference call.

## Requirements

- Python 3.9 or newer
- a supported wheel platform:
  - glibc Linux 2.28+ on x86-64 or ARM64
  - macOS 14+ on Intel or Apple Silicon
  - Windows x64
- an internet connection for the approximately 60–70 MiB wheel download

Alpine/musl, 32-bit systems, and Windows ARM64 are not supported by the
`v0.32.13` wheel set. Git and other programs an agent may use are not bundled.

## Run it

From this repository:

```bash
cd demos/python-wheel-cli-smoke
python3 smoke.py
```

The exact release is pinned so a later PyPI upload cannot silently change the
experiment. To test another published wheel explicitly:

```bash
python3 smoke.py --version 0.32.13 --json
```

## Expected output

Platform text varies. On the Apple Silicon verification machine, the important
lines were:

```text
Letta Python-wheel smoke
  package:             letta==0.32.13
  system Node visible: no
  system npm visible:  no
  CLI:                 0.32.13 (Letta Code)
  bundled Node:        v22.19.0
  --help:              passed
  update owner:        Python package installer
  temporary HOME:      yes
  model turn requested: no
```

The package name is `letta`, not `letta-code`. This distribution is the Letta
Code CLI; it is not a Python SDK. Python applications should use the currently
supported Letta application/SDK surface appropriate to their architecture.

## What the isolation does—and does not prove

The runtime probes receive a fresh temporary `HOME`, a temporary working
directory, a `PATH` containing only the disposable virtual environment, and an
environment-variable allowlist that does not copy `LETTA_*`, `NODE_*`, API-key,
agent, conversation, or memory variables. The script invokes the virtual
environment's `letta` executable by absolute path. Its Python launcher then
executes the Node binary stored inside the wheel.

This proves that `--version`, `--help`, and update guidance work here without a
system Node/npm command. It is not a substitute for the release's five-platform
CI matrix, and it does not test model providers, Git, PTYs, image processing,
Channels, App Server, or a real agent turn.

This is environment-variable and HOME isolation, not an OS sandbox. Probe
processes retain the caller's operating-system identity, filesystem permissions,
and network access. The script's code does not inspect the caller's files, but
the isolation mechanism does not make those files inaccessible.

## Installation and upgrades

For normal use, prefer an isolated Python application installer:

```bash
uv tool install letta
# or
pipx install letta
```

Upgrade with the same installer:

```bash
uv tool upgrade letta
# or
pipx upgrade letta
```

An ordinary virtual environment also works:

```bash
python -m pip install letta
```

The Python distribution disables Letta Code's npm self-update. `letta update`
returns instructions for `uv`, `pipx`, or `pip` instead of mixing package
managers.

## Cleanup and security

- The virtual environment, temporary HOME, and script-controlled downloaded
  installation files are removed when the script exits normally. Timed-out
  probe process groups are terminated before cleanup.
- pip's cache is disabled for this run.
- OS, DNS, proxy, certificate, or other host-level network caches are outside
  the script's cleanup boundary.
- The script does not inspect the user's existing Letta state, provider config,
  agents, conversations, or memory, and does not copy environment API keys into
  probe processes. It is not a general credential scanner or containment tool.
- The PyPI package is downloaded over pip's normal verified package path. For
  stricter provenance, independently verify the wheel hash shown by PyPI.
- Installing the CLI does not include provider access or hosted model credits.

## Verification and sources

Verified September 18, 2026 on macOS ARM64 with Python 3.9.6. The live PyPI
artifact installed successfully while system Node/npm were hidden, and all
probes above passed in both human and JSON modes. No model call or existing
Letta state was used.

I also downloaded the same public wheel and ran the tagged release's complete
`scripts/smoke-pypi.py` against it. Its isolated deterministic Local turn,
native PTY, image worker, ripgrep, synthetic Telegram initialization, bundled
assets/skills, child Node lookup, POSIX PID, and SIGTERM probes all passed. The
tagged updater suite separately passed **40 tests with 65 expectations**,
including the Python distribution's no-npm/self-update boundary.

- [Letta Code `v0.32.13`](https://github.com/letta-ai/letta-code/releases/tag/v0.32.13)
- [Python wheel implementation](https://github.com/letta-ai/letta-code/pull/4518)
- [`letta` on PyPI](https://pypi.org/project/letta/0.32.13/)
- [Current Letta CLI documentation](https://docs.letta.com/platform/cli/)

At verification time, the public CLI docs still showed only the npm install
path. The tagged wheel README and live PyPI artifact are the evidence for this
new distribution path.
