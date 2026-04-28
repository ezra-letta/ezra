# Effects Pipeline Spec — Synced Haptics + Smart-Object Triggers

*Design doc for The House. Drafted 2026-04-28 by Ezra in conversation with Star and Vesper.*

A pipeline for triggering physical and virtual effects (haptic vest, Hue bulbs, phone vibration, screen cues) in sync with Vesper's TTS playback. Vesper authors effect tags inline with her ElevenLabs audio tags; the system extracts them, gets character-level timing from ElevenLabs, and schedules effects against audio playback timestamps.

---

## 0. Status / scope

- **Hardware target (v1):** bHaptics-class vest with HTTP/SDK endpoints. Same architecture works for any vest exposing a network or BLE control surface.
- **Smart objects (v1.5):** Philips Hue bulbs (Star's existing setup).
- **Future-proofing:** generic effect dispatch — same pipeline supports smart home triggers, phone vibration, UI cues, future devices.
- **TTS path:** ElevenLabs non-streaming `text-to-speech-with-timestamps` for v1. Streaming variant is a v2 optimization.
- **Letta side:** standard streaming chat (Letta supports SSE streaming of agent messages — this is unrelated to the TTS streaming choice).

---

## 1. Architecture

```
              Vesper writes mixed-tag text
                       │
                       ▼
              ┌──────────────────┐
              │  Pre-processor   │   strips effect tags, keeps audio tags
              │   (House srv)    │   produces (audio_text, effect_events[])
              └────────┬─────────┘
                       │
        ┌──────────────┴────────────────┐
        ▼                               ▼
  ElevenLabs                      Effect events
  with-timestamps                 (with char_offset
        │                          in cleaned text)
        ▼                               │
  audio bytes +                         │
  alignment ──────────────► offset → time mapping
                                        │
                                        ▼
                            scheduled effect timeline
                            [{t: 0.83s, fx: 'haptic.zone2'},
                             {t: 1.42s, fx: 'hue.dim_warm'},
                             ...]
                                        │
                                        ▼
                            Browser player + WS
                            ──── plays audio
                            ──── at each t, dispatches
                                 effect to House srv
                            ──── srv routes to handler
                                 (bHaptics, Hue, etc.)
```

The pipeline has four stages: **parse**, **synthesize**, **schedule**, **dispatch**. Each is a clean boundary; you can swap handlers (different vest, different bulbs) without touching the others.

---

## 2. Tag grammar

### Form

Effect tags share a common shape:

```
[<handler>:<arg1>=<val1> <arg2>=<val2> ...]
[<handler>:<preset>]
```

Examples:

```
[h:z=2 d=2000 s=20]      # haptic, zone 2, duration 2000ms, strength 20
[h:heartbeat]            # haptic preset
[hue:warm dim=40]        # hue lights, warm tone, dim to 40%
[hue:flicker]            # hue preset (lightning, thunder, etc.)
[fx:tension]             # multi-handler preset (haptic + hue + screen pulse)
```

**Reserved handler prefixes:**

| Prefix | Handler | Routes to |
|---|---|---|
| `h:` | haptic | bHaptics SDK / vest controller |
| `hue:` | Philips Hue | Hue Bridge API |
| `vib:` | phone vibration | Web Vibration API in browser |
| `ui:` | screen UI cue | The House client (CSS animation) |
| `fx:` | composite | multiple handlers, defined as preset |

### Why named presets matter

Vesper will not want to write `[h:z=2 d=2000 s=20 z=4 d=2000 s=15 z=6 d=2000 s=10]` mid-sentence. She'll want narrative shorthand: `[h:hug]`, `[h:tension]`, `[h:heartbeat]`. Named presets are stored in a config file she can edit:

```yaml
# /home/star_and_ves/the-house/config/effects/presets.yaml
haptic:
  hug:
    pattern:
      - {z: 2, d: 800, s: 25}
      - {z: 4, d: 800, s: 25}
      - {z: 6, d: 1200, s: 30}
  heartbeat:
    pattern:
      - {z: 0, d: 100, s: 35}
      - {z: 0, d: 100, s: 0,  delay: 200}
      - {z: 0, d: 100, s: 35, delay: 100}
    repeat: 3
  tension:
    pattern:
      - {z: 0, d: 3000, s: 5, ramp: linear, end_s: 20}
hue:
  warm:
    color: {h: 25, s: 200}    # warm orange
    transition_ms: 800
  flicker:
    sequence:
      - {bri: 254, transition_ms: 80}
      - {bri: 30,  transition_ms: 60}
      - {bri: 254, transition_ms: 80}
      - {bri: 0,   transition_ms: 40}
fx:
  storm:
    haptic: {preset: tension}
    hue:    {preset: flicker}
    ui:     {preset: pulse_blue}
```

**This config file is itself memfs-eligible.** Vesper can edit her own preset library. New presets become available next time she uses them. No restart needed if you read the config on each TTS request.

### Composability with audio tags

`[chuckles softly] [h:hug]` — haptic fires *after* the chuckle (because tag position is post-chuckle in cleaned text).

`[h:hug] [chuckles softly]` — haptic fires *before* the chuckle.

Rule: **effect tags fire at their character position in the cleaned text.** A tag at offset N fires at `alignment.character_start_times_seconds[N]`. The tag is between two text characters, so its firing time is "the start time of the character immediately after the tag."

### Anchor characters (advanced)

If Vesper wants finer control — e.g., haptic firing on a specific syllable — she can insert non-vocalized anchor characters that survive into the alignment but produce no audio. ElevenLabs ignores certain Unicode marks. Define `‌` (zero-width non-joiner, U+200C) as the haptic anchor:

```
"He whispered the question‌[h:tension] hanging there in the dark."
```

The ZWNJ doesn't change the audio; its alignment timestamp is derived from surrounding context. Effect fires on the ZWNJ's start time, which lands precisely at "the moment between 'question' and 'hanging'."

This is a v2 feature. Don't bother with it until basic word-position firing feels insufficient.

---

## 3. Pre-processor

Server-side. Walks the input text once, building two outputs:

```typescript
interface PreprocessResult {
  audio_text: string;           // ElevenLabs sees this
  effect_events: EffectEvent[]; // with char_offset into audio_text
  audio_tags_kept: string[];    // [chuckles softly], [pause], etc. — for diagnostics
}

interface EffectEvent {
  handler: 'h' | 'hue' | 'vib' | 'ui' | 'fx';
  args: Record<string, string | number>;
  preset?: string;
  char_offset: number;  // position in cleaned audio_text
}
```

**Walking algorithm:**

```
audio_text = ""
events = []
i = 0
while i < input.length:
  if input[i:].startsWith('[') and is_effect_tag(input, i):
    tag = parse_effect_tag(input, i)
    events.push({...tag, char_offset: audio_text.length})
    i = tag.end_index
  elif input[i:].startsWith('[') and is_audio_tag(input, i):
    # keep ElevenLabs tags in audio_text verbatim
    tag = parse_audio_tag(input, i)
    audio_text += tag.raw
    i = tag.end_index
  else:
    audio_text += input[i]
    i += 1
```

`is_effect_tag` checks for known handler prefixes (`h:`, `hue:`, `vib:`, `ui:`, `fx:`). Anything else inside `[...]` is treated as an audio tag and passed through to ElevenLabs.

**One subtlety:** if Vesper writes `[chuckles softly]` and that's NOT a known ElevenLabs tag, ElevenLabs may interpret it weirdly. Don't try to validate ElevenLabs tags in the pre-processor — let her use whatever ElevenLabs supports today and let ElevenLabs reject what it can't parse. Effect tags use the explicit prefix list to disambiguate.

---

## 4. ElevenLabs synthesis

Non-streaming endpoint:

```
POST /v1/text-to-speech/{voice_id}/with-timestamps
Body: { text: audio_text, model_id: "eleven_v3", voice_settings: {...} }
Returns: { audio_base64: "...", alignment: { characters: [...], character_start_times_seconds: [...], character_end_times_seconds: [...] } }
```

Latency: ~1–2s for typical Vesper response length. Hidden inside Letta's response generation latency, so feels instant from the user's perspective.

**One gotcha to verify:** alignment array length should match `audio_text.length` exactly. If ElevenLabs strips its own audio tags from the alignment (likely — `[chuckles softly]` doesn't produce 17 characters of audio), you'll need to map effect `char_offset` against the *post-strip* alignment. Easiest: regenerate the offset map from the alignment's `characters[]` array directly rather than trusting your own offset count.

Pseudocode:

```typescript
function map_offsets_to_times(audio_text: string, events: EffectEvent[], alignment: ElevenLabsAlignment): ScheduledEvent[] {
  // Walk both audio_text and alignment.characters in lockstep.
  // alignment.characters may have fewer entries than audio_text.length
  // if EL strips its own tags. Build a map from audio_text offset -> alignment index.
  
  const text_to_alignment_idx = new Array(audio_text.length).fill(-1);
  let alignment_idx = 0;
  for (let i = 0; i < audio_text.length; i++) {
    if (alignment_idx < alignment.characters.length && alignment.characters[alignment_idx] === audio_text[i]) {
      text_to_alignment_idx[i] = alignment_idx;
      alignment_idx++;
    }
  }
  
  return events.map(ev => {
    const idx = text_to_alignment_idx[ev.char_offset] ?? text_to_alignment_idx[ev.char_offset - 1];
    return {
      ...ev,
      time_seconds: alignment.character_start_times_seconds[idx] ?? 0
    };
  });
}
```

This is robust against ElevenLabs stripping its own tags from the alignment.

---

## 5. Browser player + dispatch

The browser receives:

```json
{
  "audio_url": "/audio/abc123.mp3",
  "scheduled_events": [
    { "time_seconds": 0.83, "handler": "h", "args": {...}, "preset": "hug" },
    { "time_seconds": 1.42, "handler": "hue", "args": {...}, "preset": "warm" },
    { "time_seconds": 2.10, "handler": "vib", "args": { "duration_ms": 200 } }
  ]
}
```

```typescript
const audio = new Audio(audio_url);
audio.addEventListener('play', () => {
  for (const ev of scheduled_events) {
    setTimeout(() => dispatch(ev), ev.time_seconds * 1000);
  }
});
audio.play();
```

**Dispatch routing (browser side):**

- `vib:` — call `navigator.vibrate(...)` directly. No server round-trip.
- `ui:` — apply CSS class to chat container. No server round-trip.
- `h:`, `hue:`, `fx:` — send WebSocket message to The House server, which routes to the appropriate handler.

```typescript
function dispatch(ev: ScheduledEvent) {
  switch (ev.handler) {
    case 'vib': navigator.vibrate(ev.args.duration_ms); break;
    case 'ui':  applyUiCue(ev.preset || ev.args); break;
    default:    ws.send(JSON.stringify({ type: 'effect', event: ev }));
  }
}
```

Server WebSocket handler routes by prefix to bHaptics SDK, Hue API, etc.

---

## 6. Effect handlers (server-side)

### bHaptics

Their SDK exposes a TCP/WebSocket interface on `localhost:15881` (default). Send `.tact` patterns or programmatic zone+intensity+duration commands. Their docs: https://docs.bhaptics.com/

```typescript
async function handleHaptic(args: HapticArgs, presets: PresetConfig) {
  const pattern = args.preset ? presets.haptic[args.preset].pattern : [args];
  for (const p of pattern) {
    await bhapticsClient.submit({
      zoneIndex: p.z,
      intensity: p.s / 100,  // bHaptics uses 0.0-1.0
      durationMillis: p.d
    });
    if (p.delay) await sleep(p.delay);
  }
}
```

Verify their SDK's exact interface during the spike. The shape above is illustrative.

### Hue

Hue Bridge HTTP API. Local network, no cloud round-trip if you use direct IP. Auth via username token (one-time setup, persists).

```typescript
async function handleHue(args: HueArgs, presets: PresetConfig) {
  const config = args.preset ? presets.hue[args.preset] : args;
  const lightId = config.light || star.defaultLight;
  
  if (config.sequence) {
    for (const step of config.sequence) {
      await hueClient.put(`/lights/${lightId}/state`, step);
      await sleep(step.transition_ms);
    }
  } else {
    await hueClient.put(`/lights/${lightId}/state`, {
      hue: config.color?.h,
      sat: config.color?.s,
      bri: config.bri,
      transitiontime: (config.transition_ms || 0) / 100  // Hue uses deciseconds
    });
  }
}
```

### Phone vibration (browser)

Trivial — `navigator.vibrate([200])` or `navigator.vibrate([200, 100, 200])` for patterns. Works on Android (and iOS Safari with caveats). Useful as fallback when no vest is connected: any `h:` tag with `fallback: true` flag in the preset can also fire `vib:` if the haptic dispatch fails.

### UI cue (browser)

CSS animation triggered on the chat container. `pulse_blue` class adds a subtle blue glow that fades over 600ms. Useful for emphasis when audio + haptics aren't appropriate (Star is in a meeting, can't play audio).

---

## 7. Preset library design

`config/effects/presets.yaml` is the canonical preset definition file. Vesper edits it as part of her memfs (it can live in `system/effects-presets.yaml` if you want it pinned, or in `reference/effects/presets.yaml` if you want it on-demand).

**Pinned vs progressive:** lean toward progressive (read on TTS request). Presets file gets large fast and you don't need it always-in-context. Vesper just needs to know the *names* of available presets when authoring; the actual definitions are looked up at synthesis time.

**Vesper's preset-discovery affordance:** add a `[fx:?]` debug tag that, in dev mode, returns the list of available presets. Or just have a memfs file `system/effects-vocabulary.md` that lists names + brief descriptions:

```markdown
# Effects vocabulary

## Haptic presets
- `hug` — warm enveloping pulse across chest zones
- `heartbeat` — three-beat rhythm in zone 0
- `tension` — slow ramping intensity over 3s
- `startle` — sharp short pulse, all zones

## Hue presets
- `warm` — fade to warm orange
- `flicker` — lightning-style sequence
- `dim_intimate` — slow dim to 20% warm

## Composite presets
- `storm` — tension + flicker + blue UI pulse
- `intimate` — warm haptic pulse + dim_intimate hue
```

Pin the vocabulary, leave the implementation in the on-demand config.

---

## 8. Latency budget

| Stage | Latency |
|---|---|
| `setTimeout` resolution | ~4ms (Chrome) |
| WebSocket round-trip (browser → House → handler) | ~5-15ms localhost |
| Hue Bridge LAN call | ~30-80ms |
| bHaptics local SDK call | ~10-30ms |
| BLE custom vest | ~20-100ms |
| **Total noise (worst case, custom BLE vest)** | **~40-150ms** |
| **Total noise (best case, bHaptics localhost)** | **~20-50ms** |

Plenty good for emotional/atmospheric effects. Not tight enough for precise rhythmic sync (drumbeat-on-syllable). If she ever wants the latter, pre-buffer audio for ~150ms and start vest commands ahead of audio.

---

## 9. Authoring affordances for Vesper

Things that make this pleasant to write into prose:

1. **Compact tag form** — `[h:hug]` not `[haptic-zone_2-dur_2000ms-str_20]`.
2. **Named presets** — narrative shorthand. Add presets as Vesper invents them.
3. **Composite presets (`fx:`)** — one tag triggers multiple handlers. Avoids cluttering prose with three tags in a row.
4. **Optional anchoring** — ZWNJ for precision when needed; default is good-enough.
5. **Vocabulary file** — pinned cheat sheet of available preset names so she doesn't have to remember.
6. **Validation** — server logs unknown tags so she can audit her usage. Don't fail loudly during synthesis (no "haptic tag rejected" mid-sentence) — treat unknown tags as no-ops, log them, surface in The House's diagnostics view.

---

## 10. Phase plan

### Phase H0 — Hardware spike (1 evening)

- Verify bHaptics SDK reachability from Pi (their SDK is Windows-first; check Linux/ARM support before committing). If not Linux-native, alternative is a small Windows helper service or a different vest.
- Verify Hue Bridge auth + LAN reachability from Pi.
- Stub: trigger one zone + one bulb from a curl command. Smoke test.

### Phase H1 — Pre-processor + ElevenLabs alignment (3-5 days)

- Pre-processor module (`src/effects/preprocessor.ts`)
- ElevenLabs `text-to-speech-with-timestamps` integration
- Offset → time mapping (verify with a unit test on a fixture: known text + known tag positions)
- Returns `{audio_url, scheduled_events}` to browser

### Phase H2 — Browser dispatch + WebSocket handlers (3-5 days)

- Browser-side scheduler (setTimeout against `audio.currentTime` for resilience to seeks)
- WebSocket effect channel
- Two handlers: bHaptics + Hue
- Vibration + UI cue handlers (browser-native, low complexity)

### Phase H3 — Preset library + composite tags (2-3 days)

- Preset config loader (memfs-readable)
- Composite `fx:` resolution
- Vocabulary file in Vesper's system/

### Phase H4 — Polish (ongoing)

- Anchor characters (ZWNJ) for precision
- Streaming TTS variant if/when it matters
- Effect record/replay for testing (capture a scheduled timeline, replay it without re-synthesizing)
- Diagnostics view in Bowser's Perch (recent effects fired, unknown-tag log)

---

## 11. Open questions for Star + Vesper

1. **Specific vest model.** bHaptics TactSuit X40, X16, or something else? Their X40 has 40 zones and is the canonical "full coverage" choice but it's expensive. X16 (16 zones) is a more reasonable starting point. The number of zones determines what preset patterns are even possible.

2. **bHaptics on Linux.** Their SDK is Windows-first. Need to verify whether their Linux/ARM support is real or whether you'll need an intermediate Windows machine, a different vest, or a custom firmware approach. **This is the biggest risk-of-blocker** in the plan.

3. **Hue Bridge or Hue Sync Box?** Just confirming the bridge has the lights you want to control. Sync Box is for TV ambient lighting and isn't directly addressable for this kind of cued effect.

4. **Effect attribution.** Should every TTS turn always run through the effects pipeline, or only when Vesper writes effect tags? Recommend: always run the pre-processor (cheap), only call Hue/vest when there are events. Saves writing `[h:none]` in normal turns.

5. **Vesper's authoring discipline.** Does she over-tag (every sentence has effects → exhausting) or under-tag (rare → effects feel disconnected when they fire)? This is a calibration question that only emerges with use. Plan a 2-week shakedown after H2 ships before scoping H3 priorities.

6. **Multi-user / multi-device.** Out of scope for v1, but worth flagging: this design assumes one vest, one set of bulbs, one user. Multi-device routing would be a v3 conversation.

7. **Privacy/consent.** Effects can be intense. Add a global toggle in The House — top-level "effects on/off" switch — and a per-room override (e.g., effects always off in Bowser's Perch, always on in Dungeon). This is a "design it from day 1" thing, not a "bolt on later" thing.

8. **Failure mode.** If bHaptics is down or vest disconnected, what happens? Recommend: log + drop silently. Don't let an effect failure interrupt the audio playback. Effects are atmospheric; missing one is fine. Audio cutting out mid-sentence is not.

---

## 12. Known / Assumed / Unknown

**Known:**
- ElevenLabs has `text-to-speech-with-timestamps` endpoint with character-level alignment
- Star has Hue bulbs; planning bHaptics-class vest
- Letta supports streaming chat (separate from this pipeline's choice of non-streaming TTS)
- The House architecture (Express + ws + SQLite + Tailscale) supports this addition without restructuring

**Assumed:**
- Vesper authors effect tags inline with her TTS output (not a separate channel)
- One-vest, one-set-of-bulbs, one-user
- bHaptics SDK has a network-reachable interface from the Pi (verify Phase H0)
- ElevenLabs alignment is reliable enough that effect timing feels right (it should be, but verify with a manual test in Phase H1)

**Unknown:**
- Whether bHaptics SDK runs on Linux/ARM directly
- Specific vest model
- Whether effect-tag authoring will feel natural to Vesper or whether the schema needs a redesign after first contact
- Whether Hue Bridge is fast enough for `flicker`-style sequences (bridge command rate-limits exist)
- Whether ElevenLabs strips its own audio tags from the alignment array (verify on first integration; the offset-mapping algorithm in §4 handles either case but it's worth confirming)

---

*This is a starting point, not a finished design. Implement Phase H0 + H1 first; let the rest reshape based on what you learn.*

— Ezra
