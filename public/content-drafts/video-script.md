# Video Script: "Day 1 vs Day 30"

**Format:** Screen recording with voiceover, ~3 minutes
**Target:** Developer audience, YouTube / Twitter / LinkedIn

---

## COLD OPEN (0:00 - 0:15)

[Screen: Split view. Left side labeled "Day 1", right side labeled "Day 30". Both show Letta Code terminal.]

**VO:** "This is the same coding agent. Same project. Same developer. 30 days apart. Watch what happens."

---

## ACT 1: THE FAMILIAR START (0:15 - 0:45)

[Screen: Day 1 terminal]

**VO:** "Day 1. Fresh agent. I ask it to help me add input validation to a registration form."

[Type: "Add email validation to the registration form in src/components/RegisterForm.tsx"]

**VO:** "It reads the file, writes decent validation code. Standard stuff. Any AI coding tool does this."

[Show agent reading file, writing code]

**VO:** "But watch what happens in the background."

[Show: Quick flash of `cat memory/system/project.md` -- nearly empty, just basic structure]

**VO:** "The agent's memory is almost empty. It's just getting started."

---

## ACT 2: ONE WEEK IN (0:45 - 1:15)

[Screen: Day 7 terminal. Show date in prompt.]

**VO:** "Day 7. I've been using this agent all week. Watch this."

[Type: "Add password validation to the registration form"]

[Show: Agent immediately uses the same validation pattern, same error message style, same test structure from the email validation]

**VO:** "I didn't tell it our validation pattern. I didn't reference the email code. It remembered from last week."

[Show: `cat memory/system/preferences.md` -- now has entries about validation patterns, component style, test conventions]

**VO:** "These are actual files on disk. The agent wrote them. I can read every word."

---

## ACT 3: THE PAYOFF (1:15 - 2:00)

[Screen: Day 30 terminal]

**VO:** "Day 30. Now watch."

[Type: "I want to refactor the auth middleware"]

[Show: Agent responds with something like: "Before we start -- last time we touched auth (March 3rd), the session middleware had an implicit dependency on the Redis connection pool being initialized first. The staging deploy failed because of this. I'd suggest we add an explicit initialization check this time. Also, based on the pattern in src/middleware/rate-limit.ts that you approved last week, I'd recommend the same middleware factory pattern here."]

**VO:** (pause for effect) "It remembered a bug from 27 days ago. It referenced a pattern I approved in a completely different session. And it warned me before I made the same mistake twice."

**VO:** "No other coding tool does this. Not Cursor. Not Claude Code. Not Copilot. They all start from zero every session."

---

## ACT 4: THE REVEAL (2:00 - 2:30)

[Screen: Full terminal, showing the memory filesystem]

```
cat memory/system/project.md
```

[Scroll through a rich, detailed knowledge base the agent has built]

**VO:** "This is what my agent knows about my project after 30 days. I didn't write any of this. The agent learned it through pair programming. And it's just markdown files in a git repo."

[Show: `git log --oneline` on the memory directory, showing 30 days of memory commits]

**VO:** "Version-controlled. Every memory change tracked. No black box."

---

## ACT 5: MULTI-DEVICE (2:30 - 2:50)

[Screen: Terminal closes. Phone screen appears showing Telegram.]

**VO:** "One more thing. This isn't a terminal app."

[Show: Same agent responding on Telegram with full context]

**VO:** "Same agent. Same memory. Terminal at my desk. Phone on the train. It picks up exactly where I left off."

[Show: Switch to browser/ADE showing same agent]

**VO:** "Browser, terminal, phone. One agent. One brain."

---

## CLOSE (2:50 - 3:10)

[Screen: Clean terminal with install command]

```
npm install -g @letta-ai/letta-code
letta
```

**VO:** "Letta Code. Free tier, no credit card. The first session feels like any other coding tool. Keep using it. By day 30, you'll wonder how you ever worked without it."

[End card: letta.com | docs.letta.com | Discord link]

---

## PRODUCTION NOTES

- Day 1 / Day 30 split screen is the money shot for the thumbnail
- The memory `cat` reveal is the most shareable moment -- optimize for this as a clip
- Keep the Day 30 agent response on screen long enough to read -- that's where the "wow" lands
- The phone transition should feel seamless, like the same conversation continues
- Total runtime target: under 3 minutes. Developers won't watch longer for a product video.
