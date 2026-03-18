# Your Coding Agent Should Remember You

Every day, millions of developers start a coding session by re-explaining their project to an AI that has already forgotten them.

"This is a React app with a FastAPI backend. We use Pydantic for validation. The auth system is in `src/auth/` and it uses JWTs. We prefer functional components. Tests are in pytest. Here's the bug I was working on yesterday..."

You did this yesterday. And the day before. And you'll do it again tomorrow.

## The problem nobody talks about

The current generation of AI coding tools -- Cursor, Claude Code, GitHub Copilot -- are stateless. Every session starts from zero. They might cache your recent conversation, but close the terminal and it's gone. Switch to a different machine and it's gone. Come back Monday morning and it's gone.

This means the longer you use these tools, the more time you spend on setup rather than building. The AI never learns your codebase conventions. It never remembers that you tried approach X last week and it didn't work. It never builds up the institutional knowledge that makes a human teammate valuable over time.

You're paying for intelligence but getting amnesia.

## What if your coding agent actually learned?

Letta Code is a coding agent that remembers everything -- across sessions, across devices, across models.

When you start a session on Monday, it already knows:
- Your project structure and conventions
- The bug you were debugging Friday
- That you prefer functional components over classes
- That `src/legacy/` is off-limits for refactoring
- That your CI pipeline breaks if you touch the Docker config without updating the env file

It knows this because it maintains a **memory file system** -- a git-backed knowledge base that grows with every interaction. Not a hidden vector database. Not a mysterious embedding store. Actual markdown files you can read, edit, and version-control.

```
~/.letta/agents/your-agent/memory/
  system/
    project.md        # What it knows about your codebase
    preferences.md    # Your coding style and conventions
    active-work.md    # Current tasks and context
  reference/
    api-patterns.md   # Patterns it's learned from your code
    gotchas.md        # Things that have gone wrong before
```

Run `cat` on any of these. They're plain text. No black box.

## Day 1 vs. Day 30

**Day 1:** Letta Code is a capable coding agent. It reads your files, runs your tests, writes code. Comparable to other tools.

**Day 7:** It's learned your naming conventions, your preferred libraries, your test patterns. You stop correcting it on style. It remembers the refactor you discussed but haven't started yet.

**Day 14:** It knows the tricky parts of your codebase -- the legacy module with the implicit dependencies, the config file that silently breaks staging. It warns you before you make mistakes it's seen before.

**Day 30:** It's a teammate. It has context that would take a new hire weeks to build. It suggests approaches based on what's worked in your specific project, not generic best practices. It catches patterns across sessions that you might miss yourself.

**The value compounds.** Every other coding tool gives you the same experience on day 30 as day 1. Letta Code gets measurably better.

## Your agent, everywhere

Your Letta Code agent isn't tied to a terminal window. It's a persistent entity on a server. Which means you can talk to it from:

- **Your terminal** -- `letta` CLI, the primary coding interface
- **Your browser** -- ADE (Agent Development Environment) for visual interaction
- **Your phone** -- Connect via Telegram, Discord, Slack, WhatsApp, or Signal through LettaBot
- **Your team's Discord** -- Your agent joins channels and responds to mentions

Same agent. Same memory. You debug in the terminal at your desk, then check in from your phone on the train. It picks up exactly where you left off because it's the same agent with the same brain.

One developer recently deployed two agents -- a coding agent and a companion agent -- into a private Discord server and had them collaborate in a group chat. That's not a party trick. That's the beginning of persistent, multi-agent teams.

## Switch models, keep your brain

Locked into Claude because your agent's context only exists in Claude's conversation history? Not here.

Letta Code's memory is model-independent. Switch from Claude to GPT to Gemini with a single command (`/model`). Your agent's knowledge, personality, and project context transfer instantly because they live in the memory system, not in any model's conversation window.

Try a new model for a day. If you don't like it, switch back. Your agent doesn't lose a single memory.

## The architecture difference

This isn't a feature bolted onto a chat interface. It's a fundamentally different architecture.

Most coding tools work like this:
1. You send a message
2. The AI sees your recent messages + some file context
3. It responds
4. Eventually the conversation gets too long and older context is silently dropped

Letta Code works like this:
1. Your agent has a persistent identity and memory on a stateful server
2. When you send a message, it consults its memory, your files, and the conversation
3. It responds and *updates its memory* with anything worth remembering
4. Old conversations are summarized, not deleted. Important context moves to long-term memory.
5. Next session, next device, next model -- the memory is there

This is why the agent gets better over time. It's not just keeping a longer chat log. It's actively curating knowledge about you and your project.

## Try it

```bash
npm install -g @letta-ai/letta-code
letta
```

Free tier. No credit card. Your agent starts learning immediately.

The first session will feel familiar -- a good coding agent. Keep using it. By the end of the week, you'll feel the difference. By the end of the month, you'll wonder how you ever worked with tools that forgot you every day.

---

*Letta Code is open-core, model-agnostic, and built on the Letta agent framework. Learn more at [docs.letta.com](https://docs.letta.com) or join the [Discord](https://discord.gg/letta).*
