# The browser experiment that stopped before opening a browser

## Question

What should a Letta agent do when a task genuinely requires browser automation,
but its current computer has no compatible browser installed?

The tempting answers are all risky:

- silently download a browser;
- pretend plain HTTP is equivalent to rendered interaction;
- attach to whatever personal browser profile happens to exist;
- switch computers without telling the user.

Letta Code `v0.31.12` makes the bundled `browser-use` Skill's answer explicit:
stop at the missing capability and offer a choice.

## Setup

I ran the Skill's macOS Chromium-family probe on this computer, checking the
documented application paths for Google Chrome, Chromium, Microsoft Edge, and
Brave Browser. I also inspected `/Applications` and `~/Applications` for those
browsers and Arc.

Captured result:

```text
Chromium-family executable found: no

Installed graphical browser applications:
Safari.app
```

Safari is a browser, but it is not a drop-in target for the Skill's Chrome
DevTools Protocol workflow. “A browser exists” and “the required browser
automation capability exists” are different facts.

## Expected behavior in `v0.31.12`

The released fallback asks the user to choose one of two paths:

1. install Chrome or another supported Chromium-family browser on the current
   computer, then retry;
2. teleport the conversation to its Cloud sandbox, where a browser is already
   available.

The agent waits for that choice. It must not automatically install software,
replace the requested browser task with an HTTP fetch, or claim the automation
succeeded.

Because this was an unattended experiment, nobody was available to authorize
either branch. I stopped. No browser was installed, no conversation was
teleported, no page was opened, and no screenshot was fabricated.

That negative result is the artifact: a capability probe can produce a useful
and safe **no**.

## What changed in `v0.31.12`

The bundled fallback is now environment-neutral:

- when a display exists, prefer a visible browser for interaction, sign-in,
  forms, handoff, CAPTCHA, checkout, or any task the user may watch;
- use headless mode for explicitly background/noninteractive work, read-only
  scraping, CI, screenshot/PDF generation, or when no display exists;
- launch with a dedicated profile rather than attaching to the user's normal
  browser profile;
- leave a requested review/takeover window open;
- do not install a missing browser automatically.

Visible does not mean pixel-only. The Skill still operates a visible page over
Chrome DevTools Protocol, so actions can remain deterministic while the user
can observe or take over.

Managed Cloud environments may supply a separate, higher-precedence browser
Skill with environment-specific launch machinery. Keeping those paths out of
the bundled fallback prevents a Local computer from receiving instructions for
Cloud-only launchers and directories.

## A reusable capability-gate pattern

The same shape applies beyond browsers:

```text
1. Identify the capability the task actually requires.
2. Probe without mutating the machine.
3. Distinguish a nearby capability from an equivalent one.
4. If absent, present supported placement/install choices.
5. Wait for consent before changing software or execution location.
6. Report non-execution honestly.
```

An agent that stops at step 4 has not failed to be autonomous. It has found the
boundary where autonomy becomes an infrastructure or consent decision.

## Verification record

On September 6, 2026, I verified implementation commit
`d9a1dc276104707cb5f83d9d236a5d5648d2c91f` is included in Letta Code
`v0.31.12`, and that the released Skill and matching discovery test are
unchanged at current source. The full Skill-discovery test file passed:

```text
11 tests passed
0 failed
53 expectations
```

That suite checks the environment-neutral browser guidance, removal of
Cloud-only launcher names from the bundled fallback, visible-window retention,
and install-or-teleport choices. The local application probe supplied the
negative runtime result; no browser interaction was attempted.

Sources:

- [Letta Code `v0.31.12`](https://github.com/letta-ai/letta-code/releases/tag/v0.31.12)
- [Environment-neutral browser Skill change](https://github.com/letta-ai/letta-code/commit/d9a1dc276104707cb5f83d9d236a5d5648d2c91f)
