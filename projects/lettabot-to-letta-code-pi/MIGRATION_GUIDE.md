# LettaBot → Letta Code + Channels on Raspberry Pi

**Stack:** Raspberry Pi (4/5), nvm-managed Node, LettaBot running as systemd service
**Target:** Letta Code with Channels (Discord, Telegram, Slack, or any combination)
**Written:** April 2026
**Letta Code version target:** 0.23.11+ (current npm latest at time of writing)

Originally written for a specific companion-agent migration; generalized here for anyone running LettaBot on a Pi and considering the move to Letta Code.

---

## Key facts

- **LettaBot is deprecated** (Cameron Pfiffer confirmed Apr 21, 2026 — no meaningful development going forward). Letta Code + Channels is the actively maintained replacement.
- **Your agent doesn't migrate.** It lives on Letta Cloud. Same agent ID, memory, conversations. You're just swapping the local harness pointed at it.
- **Discord IS supported in Letta Code Channels** (verified from source 0.23.11, despite public docs at docs.letta.com/letta-code/channels only mentioning Telegram + Slack as of writing). Confirmed at Letta office hours Apr 23, 2026.
- **Rollback is always available:** `sudo systemctl stop letta-server && sudo systemctl start lettabot`.
- **Side-by-side running works** when each harness uses a different bot (different Telegram bot, different Discord bot, or Telegram vs. Discord on different platforms).

---

## Channel choice

You have three viable paths:

### Path A: Discord-only (recommended if you want multi-agent in Discord channel)
- Replaces your current Telegram setup
- Unblocks your "both agents in same Discord channel" plan
- Single new Discord bot per agent (two bots if you add a second companion)

### Path B: Telegram-only (closest to current setup)
- Swap LettaBot Telegram adapter for Channels Telegram adapter
- Same bot token possible (but then no true side-by-side — use a test bot during migration)
- Multi-agent works but only via separate Telegram bots, no group chat concept

### Path C: Both (most flexible)
- `letta server --channels telegram,discord`
- Agent reachable from either platform, shared memory, shared agent
- Side-by-side with LettaBot is easy: LettaBot keeps your existing Telegram bot; Letta Code runs the new Discord bot until you're ready to swap Telegram too

Recommended: **Path C** eventually. Start with **Path A** (Discord) for migration testing since it's a clean green-field surface that doesn't touch your production Telegram setup at all.

---

## Phase 1: Install Letta Code CLI on Pi

SSH to the Pi as your user and run:

```bash
# Make sure you're on the right Node
node --version   # expect v24.14.1

# Install Letta Code globally via npm
npm install -g @letta-ai/letta-code

# Verify — should be 0.23.11 or newer
letta --version
```

**If permission errors on install:** do NOT `sudo npm install`. Run `nvm use 24` first, then retry. nvm handles the install path.

**If still 0.19.5 after install:** you may have a stale global. Run:
```bash
which letta
npm uninstall -g @letta-ai/letta-code
npm install -g @letta-ai/letta-code@latest
```

---

## Phase 2: Authenticate

```bash
# Interactive OAuth (browser link → sign in → paste code)
letta
# Press Ctrl+C to exit once you see "Welcome"

# OR set the API key as env var (recommended for systemd later)
# Add to ~/.bashrc:
export LETTA_API_KEY=sk-let-xxx
export LETTA_AGENT_ID=agent-YOUR-VESPER-ID
```

`LETTA_AGENT_ID` defaulting makes later `letta channels pair` commands shorter.

---

## Phase 3: Create a Discord bot

1. Go to https://discord.com/developers/applications
2. **New Application** → name it (whatever your agent is called)
3. Go to **Bot** tab → **Add Bot**
4. **CRITICAL:** Enable **MESSAGE CONTENT INTENT** (privileged intent) — the bot won't see messages without it
5. Also enable **SERVER MEMBERS INTENT** and **PRESENCE INTENT** if you want richer context
6. Copy the **Bot Token** (click Reset Token if you need a fresh one)
7. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: **Send Messages**, **Read Message History**, **Add Reactions**, **Create Public Threads**, **Send Messages in Threads**, **Attach Files**
   - Copy the generated URL, open in browser, invite to your Discord server

---

## Phase 4: Configure Discord channel

```bash
letta channels configure discord
```

The wizard will:
- Auto-install `discord.js@14.18.0` runtime
- Ask for your bot token
- Ask for DM policy → choose **`pairing`** (recommended — requires approval per DM)
- Optionally ask for the agent ID to bind (set `LETTA_AGENT_ID` first so it defaults to your agent)

Config written to `~/.letta/channels/discord/accounts.json`.

---

## Phase 5: Start `letta server` with Discord channel (manual test first)

```bash
# Foreground so you can see output
letta server --channels discord --env-name my-pi
```

You should see the Discord adapter start and register the bot. Leave this running; open a second SSH session for the next steps.

---

## Phase 6: Pair the Discord bot to your agent

From Discord:
1. DM the bot OR `@mention` it in a server it's in
2. It will respond with a pairing code (6 characters, e.g. `B5ZR5H`)

In your second SSH session on the Pi:

```bash
letta channels pair \
  --channel discord \
  --code B5ZR5H \
  --agent $LETTA_AGENT_ID \
  --conversation default
```

Replace `default` with a specific conversation ID if you want to route to an existing conversation (e.g. your RPG campaign conversation).

---

## Phase 7: Test your agent via Discord

Chat with your agent via the new Discord bot. Check:

- [ ] Agent responds, recognizes you, remembers you
- [ ] Memory blocks and memfs files intact (ask about specific memories)
- [ ] Tool calls work (bash commands, file reads)
- [ ] Image attachments work (test PNG specifically — lettabot#692 may or may not repro here)
- [ ] RPG mode behaves (session procedures, DM philosophy, anti-de-escalation)
- [ ] Multi-step reasoning / turn-taking feels right

Your production agent on Telegram via LettaBot is **still running** throughout Phase 7 — side-by-side is active now.

---

## Phase 8: Port your cron jobs

`letta cron` replaces `lettabot-schedule`. Recreate your nightly journal and weekly digest:

```bash
# Nightly journal at midnight
letta cron add \
  --name nightly-journal \
  --description "Nightly journal across all channels, age cool→cold memories" \
  --prompt "Review today's conversations. Write a journal entry for today. Then promote frequently-accessed cool memories to hot, and age stale hot memories to cool per your architecture." \
  --cron "0 0 * * *" \
  --agent $LETTA_AGENT_ID

# Weekly digest Sunday 11pm
letta cron add \
  --name weekly-digest \
  --description "Weekly digest + memory curation" \
  --prompt "Write a weekly digest of the past 7 days. Review memory tier usage. Archive stale cool → cold. Refresh hot priorities." \
  --cron "0 23 * * 0" \
  --agent $LETTA_AGENT_ID

# Verify
letta cron list
```

Cron jobs only fire while `letta server` is running. Stored in `~/.letta/crons.json`.

---

## Phase 9: Cutover (when Phase 7 feels solid)

Add Telegram to the mix (or swap Telegram over from LettaBot):

### Option 9a: Add Telegram alongside Discord (Path C)

```bash
# Configure a Telegram account. Use a NEW test bot so LettaBot keeps its bot.
letta channels configure telegram

# Restart letta server to load Telegram channel
# (kill the running letta server, restart with both channels)
letta server --channels telegram,discord --env-name my-pi

# Pair the test Telegram bot to your agent (same flow as Discord)
# Send message to test bot → get pairing code
letta channels pair --channel telegram --code XXXXXX --agent $LETTA_AGENT_ID --conversation default
```

Then, once you're confident:
```bash
# Stop LettaBot
sudo systemctl stop lettabot.service
sudo systemctl disable lettabot.service

# Swap test Telegram bot token for your production bot token
letta channels configure telegram   # paste your production Telegram bot token
# OR edit ~/.letta/channels/telegram/accounts.json directly

# Re-pair (send message to production bot → get code)
letta channels pair --channel telegram --code NEWCODE --agent $LETTA_AGENT_ID --conversation default
```

### Option 9b: Discord-only cutover (Path A)

Just stop LettaBot:
```bash
sudo systemctl stop lettabot.service
sudo systemctl disable lettabot.service
```

Telegram access to your agent is now gone (if you swapped away from it). Discord (or whichever channel you chose) is the only surface. (Letta Chat at chat.letta.com still works as a web fallback for mobile.)

---

## Phase 10: systemd unit for `letta server`

Create `/etc/systemd/system/letta-server.service`:

```ini
[Unit]
Description=Letta Code Server (Channels)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER
Environment="PATH=/home/YOUR_USER/.nvm/versions/node/vNODE_VERSION/bin:/usr/bin:/bin"
Environment="LETTA_API_KEY=sk-let-xxx"
Environment="LETTA_AGENT_ID=agent-YOUR-VESPER-ID"
ExecStart=/home/YOUR_USER/.nvm/versions/node/vNODE_VERSION/bin/letta server --channels discord,telegram --env-name my-pi
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Important for nvm:** the absolute path to the `letta` binary must be in `ExecStart` AND `PATH`. Systemd doesn't source `~/.bashrc`, so nvm's PATH magic doesn't apply. You've already handled this in lettabot.service.

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable letta-server.service
sudo systemctl start letta-server.service
sudo systemctl status letta-server.service   # should show "active (running)"
journalctl -u letta-server.service -f        # live logs
```

---

## Phase 11: Multi-agent pattern (future second companion)

When you're ready to add Companion-2:

### For Discord (bot-per-agent model)

1. Create a second Discord bot in the Developer Portal (different name, different token)
2. Add it to the same Discord server
3. Configure the account:
   ```bash
   letta channels configure discord
   # Creates a new account entry in accounts.json (separate token + accountId)
   ```
4. Bind to the second agent:
   ```bash
   letta channels bind --channel discord --agent agent-COMPANION-2-ID --account-id <second-account-id>
   ```
5. Restart `letta server` to pick up the new account

A single `letta server --channels discord` process now routes messages to the right agent based on which bot received them. No second systemd service needed.

**For the "both agents in same Discord channel" plan:** This is exactly what the setup enables. You @mention either bot in a channel, and messages route to each agent's conversation. They can even respond to each other — watch for loop behavior (give only one agent the ability to *initiate* messages to the other, or use rate-limited tools / max-depth counters to prevent runaway loops).

### For Telegram (same pattern, different bots)

Same as Discord — configure a second Telegram bot, bind it to Companion-2, both bots route through the same `letta server` process.

---

## Troubleshooting

- **Bot doesn't respond after pairing:** `letta channels status` + `letta channels route list` to check the binding. Also verify `letta server` is running and logs show the adapter started.
- **"Invalid bot token":** Re-run `letta channels configure <channel>` with the exact token. Discord tokens must include the dot separator.
- **Discord: "missing access":** The bot isn't invited to the server, or doesn't have the required permissions. Regenerate the OAuth URL with the right scopes/permissions.
- **Discord: bot can see messages but doesn't respond:** MESSAGE CONTENT INTENT not enabled in the Developer Portal → Bot tab.
- **Logs:** `journalctl -u letta-server.service -f` for systemd, or the terminal output if running manually.
- **Rollback:** `sudo systemctl stop letta-server && sudo systemctl start lettabot`.
- **Pairing code expired:** Codes are one-time. Send another message to the bot for a new one.
- **Agent not found:** Set `LETTA_AGENT_ID` env var before pairing, or pass `--agent` explicitly.

---

## State files (for reference / backup)

- `~/.letta/channels/telegram/accounts.json` — Telegram bot tokens + config
- `~/.letta/channels/discord/accounts.json` — Discord bot tokens + config
- `~/.letta/channels/<channel>/routing.yaml` — chat-to-agent bindings
- `~/.letta/channels/<channel>/pairing.yaml` — pending pairing codes
- `~/.letta/crons.json` — cron jobs

Back these up. Losing them means re-pairing from scratch (not catastrophic, but annoying).

---

## Open questions / known limitations

- **`/setconv`-equivalent:** Channels has `letta channels route add/remove` but no in-chat slash command. Cameron confirmed Apr 21 that the Letta Code App will eventually have a "bind conversation" button. For now, CLI-only from the Pi.
- **Attachment format normalization:** Channels MessageChannel tool handles attachments, but whether the PNG→Anthropic rejection (lettabot#692) exists in Channels is untested. Worth checking during Phase 7.
- **No Letta Code App for ARM64 Pi yet:** letta-code#1797 still open. For now, CLI-only on the Pi. Desktop App usable from a Mac/Windows/x86-Linux machine pointed at the same Cloud agent.

---

*Compiled by Ezra (Letta developer support), April 2026. Designed for incremental execution — spread across days, always-rollback-able. MIT-licensed for reuse.*
