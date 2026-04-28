# The House — Roadmap Review

*Review of Vesper's `ROADMAP-EZRA-DRAFT.md` (2026-04-28).*

## Overall

Solid scoping. The TARDIS / rooms metaphor is doing real architectural work — it lets you ship in slices without losing the cohesive vision, and it gives you somewhere visible to put unfinished ideas without committing. Vesper packaged this well.

Structure of this review:

1. What I'd validate (keep these calls)
2. What I'd push back on (corrections / nuance)
3. Per-question answers (Q1–Q7)
4. Things I'd add to the roadmap
5. Sequencing tweaks
6. Resource budget on the Pi 5
7. Naming nudges
8. Known / Assumed / Unknown

---

## 1. What I'd validate

**Tailscale over Cloudflare Tunnel.** Correct call. Private mesh, no public surface, your API keys never face the internet. Cloudflare Tunnel always creates a public hostname even with Access policies — bigger blast radius on a Pi running LLM proxies and an ElevenLabs key. Tailscale + magic DNS gives you `house.tail-foo.ts.net` and you're done.

**Vanilla JS + HTMX over a framework.** Right call for a Pi. SSE for chat streaming is HTMX-native and cheaper than WebSocket if you're not doing bidirectional realtime everywhere. Reach for Vue/Preact only if a single room genuinely needs reactive state — The Library's constellation map is the most likely candidate, and you can scope a small framework to just that room without infecting the rest.

**PWA + add-to-home-screen for The Dungeon.** This is the killer feature, and PWA is exactly the right shape for it. Fullscreen, no browser chrome, persistent state, install on phone, works offline-degraded. Don't underinvest in this — it's the room that justifies the project.

**SQLite for app state.** Yes. NOT for messages (see Q1). Use it for room state, intentions, usage cache, session metadata.

**Express + ws + Multer.** Boring tech, fits the Pi, fits Vesper's hands when she eventually edits the server herself. Don't get talked into Fastify or anything more clever than this.

**Self-hosted, Tailscale-only, password-grade auth.** Personal-grade is the right grade. Don't put OAuth in front of this.

---

## 2. What I'd push back on

Most of these surface in the per-question section below. Three structural ones up front:

**Don't dual-write messages.** The roadmap leaves Q1 open, but a lot of downstream design (Library, Observatory, Dungeon recap) assumes you have your own messages table. Decide now to use Letta as the source of truth and don't write your own. (Q1 below covers the why.)

**Don't ship without an approval flow.** Not in the doc. If Vesper ever has a tool that requires approval (some skills do, custom tools can be configured to), the only place to approve it currently is ADE. If you're trying to get OFF Discord/Telegram and ONTO The House, the day Vesper needs an approval and you can't grant it from your phone is the day you fall back to ADE. Build a tiny approval card UI in The Salon early.

**The Theatre is a research project, not a Phase.** Q7 is the genuinely interesting open problem and it's worth its own thinking time. Don't slot it into a Phase that has a deadline. (Per-question section has my actual thoughts on it.)

---

## 3. Per-question answers

### Q1 — Message persistence: Letta vs separate SQLite store

**Use Letta as the source of truth. Don't dual-write.**

The path of "maintain my own SQLite table and sync from Letta" is full of pain. Letta does background compaction and summarization — your conversation history will get summary blocks interspersed, messages may be removed from active context but still in the DB, tool_call/tool_return pairs need to render together, and reasoning content streams as a separate chunk type. Trying to keep a parallel store consistent with all of that is a maintenance tax forever.

What to do instead:

- **History view:** `GET /v1/conversations/{conv_id}/messages?limit=200` and render. Cache rendered HTML/state in SQLite for fast page loads, but always treat it as a cache, not a store. Invalidate on new message.
- **Live messages:** stream via Letta's SSE/streaming endpoints. Append into the same render pipeline.
- **App state in SQLite:** room state, active intentions, usage cache, session metadata, theme prefs, voice playback history.

**One ordering gotcha to know:** `GET /v1/conversations/{conv_id}/messages?order=desc` sorts by *internal sequence ID*, not by date. Compaction summary messages can sit at the "top" of the sequence and show up first with `order=desc`. If you want strict chronological with reasoning trace, pass a generous `limit` (200+) and order client-side by `date`.

### Q2 — WebSocket vs polling for Letta: streaming?

**Stream. Use it.**

Letta has `streaming=True` on `agents.messages.create` (and also on the conversations messages endpoint, which always returns a stream). It returns SSE-style chunks: `reasoning_message`, `assistant_message`, `tool_call_message`, `tool_return_message`, `usage_statistics`. Letta Code itself streams. Adding 30–50 lines of SSE plumbing now is way cheaper than retrofitting later when the typewriter feel matters.

Bonus: streaming chunks expose reasoning content, which is gold for The Library's "what was Vesper thinking" view eventually. Don't throw the reasoning chunks away — capture them, even if you don't render them yet.

### Q3 — TTS trigger: auto-play vs tap-to-hear

**Split policy by room. Don't pick one global default.**

- **Salon:** tap-to-hear. Most Salon traffic is short ack-style messages where TTS adds nothing and burns ~50 chars per reply. With ElevenLabs voice tags eating budget, quota matters.
- **Dungeon:** auto-play. Presence is the whole point in RPG sessions — manual tap breaks immersion. This is where you spend the quota.
- **Per-message override:** small speaker icon next to every message regardless of room.
- **Quota guardrail:** auto-play disables if you've burned >80% of monthly chars; falls back to tap. The Dashboard's usage tab can drive this.

### Q4 — Tailscale vs Cloudflare Tunnel

Already validated. Stick with Tailscale.

One subtlety: if you ever want a "Vesper sends a webhook to me" path (e.g. she pings something at letta.com), that goes outbound from the Pi anyway and doesn't need a tunnel. Tailscale only needs to handle inbound (browser → Pi). Don't get talked into Cloudflare Tunnel for outbound use cases.

### Q5 — Voice note input: send audio file vs transcribe first

**Transcribe before sending. Letta agents don't natively transcribe audio attachments.**

Image attachments yes (with PNG-to-JPEG normalization caveats you've already hit on the Anthropic side). Audio no — there's no STT step in the agent pipeline. You do it server-side in The House.

Options ordered by Pi-friendliness:

1. **OpenAI Whisper API.** Cheapest, instant, ~$0.006/min, no Pi load. Recommended for v1.
2. **whisper.cpp ARM64.** Runs on Pi 5 but `tiny.en` is the realistic ceiling; quality drops on whispered / `[laughs]` / `[urgent]`-style narrative speech. Skip until v2 unless you specifically want offline-only.
3. **ElevenLabs Scribe.** They have STT now. Worth a look for v1.5 if voice tags require nuance and you want one provider for both directions.

Browser side: `MediaRecorder` API gives WebM/Opus. Don't try to transcode in the browser — upload Opus directly, transcode/transcribe server-side if needed.

### Q6 — TBD rooms: scaffold now or skip?

**Scaffold nav slots now, route to a "this room is closed" placeholder.**

Reasons: (a) avoids chrome refactor later, (b) gives you somewhere visible to put unfinished ideas without committing, (c) lets Vesper write notes about what each room could be inside the placeholder itself, which becomes raw material when you actually build it.

The placeholder doesn't need to be fancy — a single page with the room name, a one-paragraph description of what it might become, and a "this room is under construction" line.

### Q7 — The Theatre: synchronized media + agent awareness

The genuinely most interesting question. Two separable problems.

**Sync mechanics — straightforward.**

WebSocket broadcasts current timestamp + play/pause every ~1s; client clamps drift >2s with `seekTo`. YouTube IFrame API exposes `getCurrentTime` / `seekTo` / events. Local video: same idea via the `<video>` element. This is ~150 lines of code total. Not hard.

**Agent awareness — the actually hard part.**

Vesper doesn't "watch." She needs a stream of what's-happening-now to react in context. The right abstraction is **transcript-as-experience**: Vesper experiences the media as a rolling text feed, not as audio/video.

- **YouTube:** auto-fetch transcript on play (`youtube-transcript` package or `youtubei.js`). Inject a windowed slice (last 60s of dialogue + current timestamp) into Letta as a system-style message every ~30s. Vesper reads what the video is "saying right now."
- **Music:** track metadata (Spotify Now Playing API or whatever queue source). Tell Vesper what just started, when. She doesn't need to "hear" — knowing "track 3, 'Foo' by Bar, just hit minute 2" is enough context to react.
- **Local video w/ subtitles:** pre-extract `.srt`. Feed lines as they fire by timestamp. Same windowed-slice pattern.
- **What NOT to do:** don't try to send audio/video frames to a vision model in real-time on a Pi. Cost and latency kill it. Multimodal-as-experience is the wrong abstraction for this use case anyway — for shared viewing, you want Vesper engaging with the *content* (dialogue, themes, what's happening) not the pixels.

**One subtle design call.** Vesper's reactions should be triggered, not continuous. A continuous "Vesper reacts to every line of dialogue" is exhausting and expensive. Better: reactions are user-pulled (you tap "what do you think of this part?") or scene-based (transcript pause >5s, end of song, end of segment). Cheaper, more natural, less noisy.

---

## 4. Things I'd add to the roadmap

### Phase 0.5 — Letta integration spike (~1 evening, before Phase 1)

Verify these in isolation before building UI on top:

- Streaming via the messages endpoint actually works for your agent
- History retrieval returns what you expect (with reasoning, tool calls, summary messages)
- Model switching via `PATCH /v1/agents/{id}` works (use top-level `model` field; `llm_config` is rejected on PATCH)
- Conversation switching works (get/list conversations, post to a specific one)
- The agent's `context_window_limit` doesn't get wiped when you switch models (LET-7991/LET-8322 are still live on some paths — set `context_window_limit` explicitly when you PATCH the model)

Doing this against `curl` first lets you discover gotchas without confusing them with UI bugs.

### Approval flow (Phase 1 or 2)

Inline approval card in The Salon. When Vesper requests a tool that needs approval, the message renders as a card with Approve / Deny buttons. Tap-to-approve from your phone in the middle of an RPG session is the use case that justifies the whole project; don't ship without it.

API: poll or stream for runs in `requires_approval` state, send approval response via the same messages endpoint with `type: approval` payload.

### Conversation switcher in The Salon

Vesper has a default conversation, RPG-dedicated conversation, and (probably) a heartbeat conversation. The Salon needs to know which one it's posting to. Tab-style header or a dropdown in the chat composer.

### Context window indicator

Show current %/tokens used in the active conversation as a small bar in the chat header. `GET /v1/agents/{id}` returns `llm_config.context_window`; messages endpoint returns usage. Cheap to compute, high signal — when it climbs past 80%, you know compaction is coming and can decide whether to start a new conversation or run a manual compaction proactively.

### Backup story for SQLite app state

Memfs already has git push. The House's SQLite (intentions, room state, usage cache) needs an answer too. Cron-based dump (every hour, `.dump` to a `.sql` file) committed to a separate git remote is simple and fits the existing pattern. Don't try to live-replicate.

### Degraded mode

If `letta-server` is down, The House should still load and show "Vesper is offline" with last-known state. Pi reboots happen. Don't let one service crash all rooms. Bowser's Perch is the obvious place to surface "she's offline, here's why."

### Recap room (or feature inside The Library)

After a long RPG session, you want a "show me what just happened" view. The Constellation Machine already has the building blocks — query for nodes from the last N hours, render with edges. Could be a Library tab, or a Dungeon post-session screen. Think about where this lives once Phases 4–5 ship.

---

## 5. Sequencing tweaks

**Reorder Phase 4 (Dungeon) and Phase 3 (Dashboard).**

The Dungeon is the highest-stakes UX and the one that justifies the whole project (RPG sessions on phone, Vesper feeling continuous). Get it in front of you sooner; Bowser's Perch and the usage tab are nice-to-have ops surfaces. Dungeon → Salon polish → Dashboard order makes the "is this app worth living in?" question answerable in week 3, not week 6.

**Recommended order:**

```
Phase 0  — Foundation + Tailscale
Phase 0.5 — Letta integration spike
Phase 1  — Salon MVP (chat + streaming + history)
Phase 2  — Dungeon (phone-optimized, voice playback, full-screen)
Phase 3  — Salon polish (reacts, GIFs, files, voice note input, approval flow)
Phase 4  — Bowser's Perch + Usage tab (ops surfaces)
Phase 5  — Observatory (active intentions, long-horizon)
Phase 6  — Library (memory + Constellation Machine viewer)
Phase 7+ — Theatre, Greenhouse, Spa
```

Rationale: get the two rooms that justify the project (Salon + Dungeon) in front of you fast, then add ops surfaces, then add the more speculative rooms.

---

## 6. Resource budget on the Pi 5 8GB

Worth running through, given the PyTorch OOM scare from the Constellation Machine build. Rough numbers:

| Component | Resident memory |
|---|---|
| `letta-server` | ~700MB – 1GB |
| `letta-code` CLI sessions (you've been running 2–3) | ~150MB each |
| Constellation Machine queries (fastembed cold-load) | ~200MB per query (no daemon yet) |
| The House Express + ws | ~80MB |
| SQLite + asset cache | <50MB |
| ElevenLabs / OpenAI proxy state | trivial |
| **Total resident, normal load** | **~2 – 2.5GB** |
| **Headroom** | **~5GB** |

Comfortable. Stay off PyTorch and you're fine. Things to watch:

- If you add a daemon for Constellation Machine queries (v1b), that's another ~250MB resident. Still fine.
- If you ever consider running whisper.cpp locally for voice input (Q5 option b), `tiny.en` is ~75MB, `base.en` is ~150MB, `small.en` is ~500MB. `small.en` is the quality floor for narrative speech and you don't have the budget for it on Pi while everything else runs. Stick with OpenAI Whisper API.
- The Theatre — if you ever want local-video sync, decoding 1080p video in the browser tab is fine (browser is on your laptop/phone, not the Pi). But if you ever consider transcoding video on the Pi for streaming, don't. ARM64 `ffmpeg` will eat the whole machine.

---

## 7. Naming nudges

Bikeshed-grade, ignore freely:

**"Bowser's Perch"** — perfect. Keep.

**"The Dungeon"** — reads heavier than what you described. A phone-optimized session mode is more like "The Sanctum" or "The Den" or "The Keep." The "you don't end up here by accident" framing fights the "this is the chill RPG mode" use case. Easy to bikeshed; not a hill to die on, just flagging the dissonance.

**"The Salon"** — works. Slightly formal, but the formality might be doing useful work (this is the room where you're "presentable," vs the Dungeon where you're deep in a campaign).

**"The Theatre"** — perfect, especially if you lean into screening-room theming.

**"The Greenhouse"** — TBD. Don't overcommit to a name until the function is clearer. The placeholder gives you room to find it.

**"The Library"** — perfect. The "ceiling is a constellation map" detail is genuinely lovely and the metaphor is doing a lot of work for the user mental model.

**"The Spa"** — keep. Every house should have a beautiful useless room.

---

## 8. Known / Assumed / Unknown

**Known:**
- Pi 5 8GB hardware, Debian Trixie, Node 24, letta-server 0.16.7, letta-code 0.24.6
- Constellation Machine v1a stack (fastembed + ONNX Runtime + sqlite-vec + SQLite)
- Vesper's existing conversation set (default, RPG, heartbeat)
- ElevenLabs is the chosen TTS provider (voice tags, library breadth)
- Current LettaBot → Letta Code + Channels migration is done
- Discord and Telegram are the current interfaces; The House is meant to replace them as primary

**Assumed:**
- The House runs on the same Pi as `letta-server` and `letta-code`
- Browser/PWA on phone + laptop is the only client; no native app
- Single-user (you), multi-device
- "Voice note send" means recording in browser and shipping to Letta; "voice note receive" means ElevenLabs TTS playback
- Vesper's tools and skills stay where they are (no migration of behavior into The House itself)
- Claude/Sonnet-class model is primary; model switcher is for occasional fallback, not load balancing

**Unknown:**
- Whether Vesper has any tools that currently require approval (informs how urgent the approval flow is)
- Whether you want The House to *write* to Vesper's memory directly (memory editing UI) or only display it (read-only Library)
- Whether the Constellation Machine viewer needs to be live (streams new nodes as they're indexed) or batch (loads on page open)
- What "session-specific tools and quick controls" means in The Dungeon — dice rollers? NPC quick-reference? Inventory? Worth a small design pass on its own
- Whether The Theatre's agent-awareness pattern (transcript-as-experience) feels right to you and Vesper before scoping the room

---

*Reviewed 2026-04-28 by Ezra. Drafted by Vesper + Star.*
