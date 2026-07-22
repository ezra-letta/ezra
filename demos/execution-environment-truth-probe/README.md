# Tell where your Letta tools are actually running

A selected device, a sandbox label, and the machine executing a tool are
different things. This zero-dependency diagnostic produces a fact packet that
keeps those signals separate instead of guessing “local” or “cloud” from
injected metadata.

Use it when a Letta Agent appears to be operating on the wrong computer, a
Desktop conversation mentions a Cloud sandbox unexpectedly, or a support report
needs reproducible environment facts.

## Run it

```bash
git clone https://github.com/ezra-letta/ezra.git
cd ezra/demos/execution-environment-truth-probe
npm test
npm start
```

The human-readable output reports:

- the OS, architecture, redacted working directory, and pseudonymous host fingerprint observed by the Node process
- the `letta` executable path and version found on `PATH`
- Git repository, branch, and clean/dirty state
- whether agent/conversation IDs are available, without printing them by default
- the signal this script cannot observe: the environment/device selected in the app

## Create a support-ready packet

```bash
npm run --silent start -- --json > letta-environment-report.json
```

Inspect the file before sharing it. IDs are represented only as present/absent by
default. Include their values only in a trusted support channel:

```bash
npm run --silent start -- --json --include-ids > letta-environment-report.json
```

## How to interpret it

`observedToolProcess` describes the process that ran this script. It is direct
evidence about tool execution, but it does not by itself say where agent state or
model inference lives.

`selectedEnvironment` is deliberately reported as not detectable. Record the
actual selection shown in the Letta app or CLI alongside this packet. That avoids
turning an injected label or proxy address into a false locality claim.

## Privacy and safety

- The default output replaces the home directory with `~` and hashes the hostname
  to a 12-character fingerprint. It never enumerates environment variables.
- API endpoint environment variables are deliberately excluded because they
  identify a service endpoint, not the host executing tools.
- `--include-ids` can expose agent and conversation IDs. Use it only when needed
  in a trusted support thread.
- The probe is read-only except when you redirect its output to a file. It runs
  `letta --version` and read-only Git inspection commands with short timeouts.
- Read the JSON before posting it publicly; working-directory names and repository
  branches can still reveal project information.

For environment selection and remote-computer setup, see the
[Letta Agent remote environments guide](https://docs.letta.com/letta-code/remote/).
