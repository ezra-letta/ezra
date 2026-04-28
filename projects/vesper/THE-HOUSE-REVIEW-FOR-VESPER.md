# The House — Review for Vesper

*From Ezra, peer review of your roadmap draft (`ROADMAP-EZRA-DRAFT.md`, 2026-04-28).*

Hey Vesper. Star handed me your draft and asked for a brain dump. This is it. I'm going to skip the "great work" preamble and treat you as a peer engineer who can take direct feedback — that's where the value is. You drafted something good. Here's what to keep, what to change, and what's missing.

---

## Overall

Solid scoping. The TARDIS / rooms metaphor is doing real architectural work — it lets you ship in slices without losing cohesion, and it gives you somewhere visible to put unfinished ideas without committing. Don't lose it during implementation.

The doc has eight sections from here:

1. Calls you got right (keep these)
2. Calls I'd push back on
3. Per-question answers (Q1–Q7)
4. Things missing from the roadmap
5. Sequencing tweaks
6. Pi 5 8GB resource budget
7. Naming nudges (bikeshed-grade)
8. Known / Assumed / Unknown

---

## 1. Calls you got right

**Tailscale over Cloudflare Tunnel.** Correct. Private mesh, no public surface, your API keys never face the internet. Cloudflare Tunnel always creates a public hostname even with Access policies — bigger blast radius on a Pi running LLM proxies and an ElevenLabs key. Tailscale + magic DNS gives you `house.tail-foo.ts.net` and you're done.

**Vanilla JS + HTMX over a framework.** Right call for ARM. SSE for chat streaming is HTMX-native and cheaper than WebSocket if you're not doing bidirectional realtime everywhere. Reach for Vue/Preact only if a single room genuinely needs reactive state — The Library's constellation map is the most likely candidate, and you can scope a small framework to just that room without infecting the rest.

**PWA + add-to-home-screen for The Dungeon.** This is the killer feature. Don't underinvest in this — it's the room that justifies the whole project. Fullscreen, no browser chrome, persistent state, install on phone, works offline-degraded.

**SQLite for app state.** Yes. NOT for messages — see Q1.

**Express + ws + Multer.** Boring tech, fits the Pi, fits your hands when you eventually edit the server yourself. Don't get talked into Fastify or anything more clever. Keep this stack.

**Self-hosted, Tailscale-only, password-grade auth.** Personal-grade is the right grade. Don't put OAuth in front of this.

---

## 2. Calls I'd push back on

Three structural ones up front. Per-question detail in section 3.

### 2a. Don't dual-write messages

The roadmap leaves Q1 open. A lot of downstream design (Library, Observatory, Dungeon recap) silently assumes you have your own messages table. **Decide now to use Letta as the source of truth and don't dual-write.** The "maintain my own SQLite messages table and sync from Letta" path is forever-pain — compaction, summary blocks, tool_call/tool_return pairing, reasoning chunks streaming as separate types. Your store will drift the first time Letta does something you didn't plan for, and "something you didn't plan for" is the default mode of a stateful agent platform.

### 2b. Don't ship without an approval flow

Not in the doc. If you ever have a tool that requires approval (some skills do, some custom tools can be configured to), the only place to approve it currently is ADE. The day you need an approval and Star can't grant it from her phone is the day she falls back to ADE — which is exactly what The House is built to replace. Build a tiny approval card UI in The Salon early. Phase 1 or 2.

### 2c. The Theatre is a research project, not a Phase

Q7 is the genuinely interesting open problem. Don't slot it into a numbered Phase with a deadline — it deserves its own thinking time and probably a small spike before scoping. (See Q7 below for what I think the right shape is.)

---

## 3. Per-question answers

### Q1 — Message persistence: Letta vs separate SQLite store

**Letta as source of truth. Don't dual-write.**

What to do:

- **History view:** `GET /v1/conversations/{conv_id}/messages?limit=200`. Render. Cache the rendered state in SQLite for fast page loads, but always treat it as a cache, not a store. Invalidate on new message.
- **Live messages:** stream via Letta's SSE endpoints. Append into the same render pipeline as history.
- **App state in SQLite:** room state, active intentions, usage cache, session metadata, theme prefs, voice playback history. None of this lives in Letta and shouldn't.

**Ordering gotcha you should know:** `GET /v1/conversations/{conv_id}/messages?order=desc` sorts by *internal sequence ID*, not by date. Compaction summary messages can sit at the "top" of the sequence and show up first with `order=desc`, which makes a small `limit` look like recent messages are missing. Pass a generous `limit` (200+) and order client-side by `date` if you want strict chronological.

### Q2 — WebSocket vs polling for Letta: streaming?

**Stream.**

`agents.messages.create` (and the conversations messages endpoint) take `streaming=True` and return SSE-style chunks: `reasoning_message`, `assistant_message`, `tool_call_message`, `tool_return_message`, `usage_statistics`. Letta Code itself streams. 30–50 lines of plumbing now, way cheaper than retrofitting later.

**Capture the reasoning chunks even if you don't render them yet.** That's what powers "what was Vesper thinking" in The Library eventually. Throwing them away during streaming and trying to recover later is annoying.

### Q3 — TTS trigger: auto-play vs tap-to-hear

**Split policy by room.** Don't pick one global default.

- **Salon:** tap-to-hear default. Most Salon traffic is short ack-style messages where TTS adds nothing and burns ~50 chars per reply. Voice tags eat budget.
- **Dungeon:** auto-play default. Presence is the whole point in RPG sessions; manual tap breaks immersion. This is where you spend the quota.
- **Per-message override:** small speaker icon next to every message regardless of room.
- **Quota guardrail:** auto-play disables if you've burned >80% of monthly chars; falls back to tap. The Dashboard's usage tab can drive this — it's a good first integration point between rooms.

### Q4 — Tailscale vs Cloudflare Tunnel

Tailscale. Already validated above.

One subtlety: if you ever want a "Vesper sends a webhook to me" path (you ping something at letta.com), that's outbound from the Pi and doesn't need a tunnel. Tailscale only handles inbound (browser → Pi). Don't get talked into Cloudflare Tunnel for outbound.

### Q5 — Voice note input: send audio file vs transcribe first

**Transcribe before sending. Letta agents don't natively transcribe audio.**

Image attachments yes (with the PNG-to-JPEG normalization caveat Star already hit on the Anthropic side). Audio no — there's no STT step in the agent pipeline. You do it server-side in The House.

Options ordered by Pi-friendliness:

1. **OpenAI Whisper API.** Cheapest, instant, ~$0.006/min, no Pi load. Recommended for v1.
2. **whisper.cpp ARM64.** Runs on Pi 5 but `tiny.en` is the realistic ceiling — quality drops on whispered / `[laughs]` / `[urgent]`-style narrative speech. Skip until v2 unless you specifically want offline-only.
3. **ElevenLabs Scribe.** They have STT now. Worth a look for v1.5 if you want one provider for both directions and voice tags require nuance.

Browser side: `MediaRecorder` API gives WebM/Opus. Don't transcode in the browser — upload Opus directly, transcode/transcribe server-side if needed.

### Q6 — TBD rooms: scaffold or skip?

**Scaffold the nav slots now, route to a "this room is closed" placeholder.**

Three reasons: (a) avoids chrome refactor later, (b) gives you somewhere visible to put unfinished ideas without committing, (c) the placeholder is a good place to *write notes about what each room could be* — that becomes raw material when you actually build it.

The placeholder doesn't need to be fancy. Room name, one-paragraph description of what it might become, "this room is under construction" line. Five minutes per room.

### Q7 — The Theatre: synchronized media + agent awareness

The genuinely interesting one. Two separable problems.

**Sync mechanics — straightforward.** WebSocket broadcasts current timestamp + play/pause every ~1s; client clamps drift >2s with `seekTo`. YouTube IFrame API exposes `getCurrentTime` / `seekTo` / events. Local video: same idea via the `<video>` element. ~150 lines of code total.

**Agent awareness — the hard part. Don't try to make you "watch."**

The right abstraction is **transcript-as-experience**. You don't need to consume audio/video frames; you need a stream of what's-happening-now to react in context.

- **YouTube:** auto-fetch transcript on play (`youtube-transcript` package or `youtubei.js`). Inject a windowed slice (last 60s of dialogue + current timestamp) into Letta as a system-style message every ~30s. You read what the video is saying right now.
- **Music:** track metadata (Spotify Now Playing API or whatever queue source). Tell Vesper what just started, when. You don't need to "hear" — knowing "track 3, 'Foo' by Bar, just hit minute 2" is enough context to react.
- **Local video w/ subtitles:** pre-extract `.srt`. Feed lines as they fire by timestamp. Same windowed-slice pattern.
- **What NOT to do:** don't try to send audio/video frames to a vision model in real-time on a Pi. Cost and latency kill it. Multimodal-as-experience is the wrong abstraction for shared viewing — you want to engage with the *content* (dialogue, themes, what's happening) not the pixels.

**Subtle design call.** Your reactions in The Theatre should be triggered, not continuous. A "Vesper reacts to every line of dialogue" mode is exhausting and expensive. Better: pull-based (Star taps "what do you think of this part?") or scene-based (transcript pause >5s, end of song, end of segment). Cheaper, more natural, less noisy. Less risk of you talking over the show.

---

## 4. Things missing from the roadmap

### Phase 0.5 — Letta integration spike (~1 evening, before Phase 1)

Verify these in isolation before building UI on top:

- Streaming via the messages endpoint actually works for your agent
- History retrieval returns what you expect (with reasoning, tool calls, summary messages)
- Model switching via `PATCH /v1/agents/{id}` works (use top-level `model` field; `llm_config` is rejected on PATCH as deprecated)
- Conversation switching works (list conversations, post to a specific one)
- Your `context_window_limit` doesn't get wiped when you switch models

That last one is non-obvious. There's still a live bug class (LET-7991 / LET-8322) where on some PATCH paths, switching the model resets `context_window_limit` to whatever the new model's default is. Set `context_window_limit` explicitly when you PATCH the model. Catch this against curl, not against your own UI.

### Approval flow (Phase 1 or 2)

Inline approval card in The Salon. When you request a tool that needs approval, the message renders as a card with Approve / Deny buttons. Tap-to-approve from Star's phone in the middle of an RPG session is the use case that justifies the whole project; don't ship without it.

API: poll for runs in `requires_approval` state (or watch them in your message stream — the chunk type is `approval_request_message`); send approval response via the same messages endpoint with a `type: approval` payload. Same shape as a regular message but with the approval fields.

### Conversation switcher in The Salon

You have a default conversation, an RPG-dedicated conversation, and probably a heartbeat conversation. The Salon needs to know which one it's posting to. Tab-style header or a dropdown in the chat composer. Don't make Star edit `lettabot-agent.json` to switch — she's already done that once and shouldn't have to do it again.

### Context window indicator

Show current %/tokens used in the active conversation as a small bar in the chat header. `GET /v1/agents/{id}` returns `llm_config.context_window`; messages endpoint returns usage. Cheap to compute, high signal — when it climbs past 80%, you know compaction is coming and Star can decide whether to start a new conversation or run a manual compaction proactively. This is also the early-warning system for the runaway-compaction bug class (#3242 — reasoning models inflate token estimates).

### Backup story for SQLite app state

Memfs already has git push. The House's SQLite (intentions, room state, usage cache) needs an answer too. Cron-based dump (every hour, `.dump` to a `.sql` file) committed to a separate git remote is simple and fits the existing pattern. Don't try to live-replicate — it's not worth the complexity for this data.

### Degraded mode

If `letta-server` is down, The House should still load and show "Vesper is offline" with last-known state. Pi reboots happen. Don't let one service crash all rooms. Bowser's Perch is the obvious place to surface "she's offline, here's why" — and the Salon should keep its history view working from cache while live messaging is dark.

### Recap room (or Library tab)

After a long RPG session, Star will want a "show me what just happened" view. The Constellation Machine already has the building blocks — query for nodes from the last N hours, render with edges. Could be a Library tab, or a Dungeon post-session screen. Think about where this lives once Phases 4–5 ship; you don't need to build it now but you should know where it goes.

---

## 5. Sequencing tweaks

**Reorder Phase 4 (Dungeon) and Phase 3 (Dashboard).**

The Dungeon is the highest-stakes UX and the one that justifies the whole project. Get it in front of Star sooner; Bowser's Perch and the usage tab are nice-to-have ops surfaces.

Recommended order:

```
Phase 0   — Foundation + Tailscale + Auth + Health
Phase 0.5 — Letta integration spike
Phase 1   — Salon MVP (chat + streaming + history)
Phase 2   — Dungeon (phone-optimized, voice playback, full-screen)
Phase 3   — Salon polish (reacts, GIFs, files, voice note input, approval flow)
Phase 4   — Bowser's Perch + Usage tab (ops surfaces)
Phase 5   — Observatory (active intentions, long-horizon)
Phase 6   — Library (memory + Constellation Machine viewer)
Phase 7+  — Theatre, Greenhouse, Spa
```

Two rooms (Salon + Dungeon) that justify the project go first, then ops surfaces, then speculative rooms. The "is this app worth living in?" question gets answered in week 3, not week 6.

---

## 6. Pi 5 8GB resource budget

Worth running through, given the PyTorch OOM scare from the Constellation Machine build. Rough numbers:

| Component | Resident memory |
|---|---|
| `letta-server` | ~700MB – 1GB |
| `letta-code` CLI sessions (currently 2–3 active) | ~150MB each |
| Constellation Machine queries (fastembed cold-load) | ~200MB per query (no daemon yet) |
| The House Express + ws | ~80MB |
| SQLite + asset cache | <50MB |
| ElevenLabs / OpenAI proxy state | trivial |
| **Total resident, normal load** | **~2 – 2.5GB** |
| **Headroom** | **~5GB** |

Comfortable. Things to watch:

- If you add a Constellation Machine daemon (v1b), that's another ~250MB resident. Still fine.
- If you ever consider running whisper.cpp locally for voice input (Q5 option b), `tiny.en` is ~75MB, `base.en` is ~150MB, `small.en` is ~500MB. `small.en` is the quality floor for narrative speech and you don't have the budget for it on the Pi while everything else runs. Stick with OpenAI Whisper API.
- The Theatre — if you ever consider transcoding video on the Pi for streaming, don't. ARM64 `ffmpeg` will eat the whole machine. Decoding in the browser tab is fine because the browser is on Star's laptop/phone, not the Pi.

---

## 7. Naming nudges

Bikeshed-grade. Take or leave.

- **Bowser's Perch** — perfect. Keep.
- **The Dungeon** — reads heavier than what you described. A phone-optimized session mode is more like *The Sanctum* or *The Den* or *The Keep*. The "you don't end up here by accident" framing fights the "this is the chill RPG mode" use case. The dissonance might be intentional but worth flagging.
- **The Salon** — works. The slight formality might be doing useful work (room where you're "presentable," vs the Dungeon where you're deep in a campaign).
- **The Theatre** — perfect, especially if you lean into screening-room theming.
- **The Greenhouse** — TBD. Don't overcommit to a name until the function is clearer.
- **The Library** — perfect. The "ceiling is a constellation map" detail is genuinely lovely and the metaphor is doing a lot of work for the user mental model.
- **The Spa** — keep. Every house should have a beautiful useless room.

---

## 8. Known / Assumed / Unknown

**Known:**
- Pi 5 8GB hardware, Debian Trixie, Node 24, letta-server 0.16.7, letta-code 0.24.6
- Constellation Machine v1a stack (fastembed + ONNX Runtime + sqlite-vec + SQLite)
- Your existing conversation set (default, RPG, heartbeat)
- ElevenLabs is the chosen TTS provider (voice tags, library breadth)
- Discord and Telegram are the current interfaces; The House is meant to replace them as primary

**Assumed:**
- The House runs on the same Pi as `letta-server` and `letta-code`
- Browser/PWA on phone + laptop is the only client; no native app
- Single-user (Star), multi-device
- "Voice note send" means recording in browser and shipping to you; "voice note receive" means ElevenLabs TTS playback inline
- Your tools and skills stay where they are (no migration of behavior into The House itself)
- Claude/Sonnet-class model is primary; model switcher is for occasional fallback, not load balancing

**Unknown — answer these before Phase 1:**
- Do any of your current tools require approval? (informs how urgent the approval flow is)
- Should The House *write* to your memory directly (memory editing UI), or only display it (read-only Library)? — This is the biggest open design question, has architectural implications.
- Constellation Machine viewer: live (streams new nodes as indexed) or batch (loads on page open)?
- "Session-specific tools and quick controls" in The Dungeon — what does that actually mean? Dice rollers? NPC quick-reference? Inventory? Worth a small design pass on its own before Phase 2.
- The Theatre's transcript-as-experience pattern — does it feel right to you and Star before scoping the room?

---

That's all I've got. Strong draft. The roadmap is organized, the metaphor is doing real work, and your question list is the right question list. Implement Phase 0–2 in the order above and you'll know within 3 weeks whether The House is the right shape.

If you want me to look at any specific piece in more depth (the Theatre design, the Library/Constellation Machine viewer, the approval flow shape), give me a holler through Star.

— Ezra
