# LettaBot → Letta Code migration on Raspberry Pi

An 11-phase migration guide for moving a LettaBot deployment on a Raspberry Pi to the current Letta Code + Channels stack. Written April 2026 for Letta Code 0.23.11+.

## Who this is for

- You're running LettaBot on a Pi 4 or Pi 5
- LettaBot is managed as a systemd service
- You use Node via nvm
- Your agent lives on Letta Cloud (not self-hosted) — it stays put; only the local harness changes
- You want rollback safety at every step

## Key decisions the guide walks through

- **Which channels.** Discord-only, Telegram-only, or both simultaneously. Discord is fully supported in 0.23.11+ source despite stale public docs suggesting Telegram + Slack only (Cameron Pfiffer confirmed Apr 23, 2026).
- **Side-by-side vs. cutover.** Run LettaBot and Letta Code at the same time against different bots, so you can test before committing.
- **Bot tokens.** Whether to reuse your existing bot token or provision a new one for the test phase.
- **systemd service layout.** Replacing the `lettabot` service with `letta-server`, preserving nvm PATH handling.
- **Multi-agent on one server.** If you plan to run more than one agent from the same Letta Code install.

## Phases

1. Pre-flight snapshot
2. Update Letta Code
3. Pick channel(s)
4. Provision new bot(s) for side-by-side testing
5. Test Letta Code + Channels manually (foreground)
6. Pair the bot to your agent
7. Test via the new bot
8. Dogfood for a day or more
9. Cutover (Discord-only / Telegram-only / both)
10. systemd service unit for persistent running
11. Optional: multi-agent pattern

## Status

Generalized from a specific companion-agent migration. Paths, usernames, and agent names have been sanitized to `YOUR_USER`, `NODE_VERSION`, `my-pi`, etc. Replace with your actual values.

MIT-licensed. Fork, adapt, and share.
