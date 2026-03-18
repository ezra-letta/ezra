# Support Agent Template

A memory architecture and configuration template for building a developer support agent on Letta. Based on Ezra, Letta's own support agent.

## What this is

This is the memory structure, guidelines, and patterns that make a Letta agent effective at developer support. It's extracted from a production agent that handles hundreds of support interactions per week across Discord, Telegram, and internal channels.

## Quick start

1. Create a new Letta agent (via ADE or `letta --new`)
2. Enable context repositories (`/memfs enable`)
3. Copy the `memory-template/` files into your agent's memory directory
4. Edit `system/product.md` with your product's details
5. Edit `system/support-guidelines.md` with your team's policies
6. Connect channels via LettaBot

## Memory structure

```
memory/
  system/                    # Always in context (pinned)
    persona.md               # Agent identity and role
    product.md               # Your product's architecture and key concepts
    support-guidelines.md    # How to handle support interactions
    active-issues.md         # Currently tracked bugs and issues
    
  users/                     # Per-user knowledge (read on demand)
    _index.md                # User tracking policy
    {username}.md            # Individual user profiles
    
  reference/                 # Product reference material (read on demand)
    faq.md                   # Common questions with verified answers
    api-endpoints.md         # API reference
    sdk-signatures.md        # SDK method signatures
    doc-links.md             # Documentation URLs
    env-vars.md              # Environment variables
    
  corrections/               # Mistake log (read on demand)
    mistakes.md              # What went wrong and lessons learned
    
  troubleshooting/           # Issue resolution patterns (read on demand)
    deployment.md            # Deployment issues
    common-errors.md         # Frequently seen errors
```

### Why this structure works

- **system/** files are always in context. Put only what the agent needs on every turn: identity, core product knowledge, active issues, and behavioral guidelines.
- **users/** files let the agent remember individual users without bloating the system prompt. Read the user's file when they message, update after meaningful interactions.
- **reference/** is the agent's knowledge base. Too large for system prompt, but available on demand. The agent learns to `Read` these files when it needs specific details.
- **corrections/** is the learning loop. Every mistake gets logged with what happened and what the correct answer was. The agent reads this periodically and the patterns get internalized.
- **troubleshooting/** captures resolution patterns so the agent doesn't re-derive solutions.

## Key principles

### 1. Research before answering
The agent should search docs, check reference files, and verify claims before responding. Never guess at config values, env vars, or API parameters.

### 2. Epistemic transparency
Every factual response should indicate confidence level:
- **Known**: documented or team-confirmed
- **Assumed**: inferred from patterns
- **Unknown**: needs verification

### 3. Per-user memory
Track who users are, what they're building, what issues they've hit, and their communication preferences. This makes repeat interactions dramatically better.

### 4. Proactive issue tracking
When bugs surface in support, file tickets (Linear, GitHub, etc.) proactively. Don't wait for someone to ask. Notify the team when tickets are filed.

### 5. Correction loop
Log every mistake. Update memory when corrected. This is how the agent improves over time -- not through retraining, but through accumulated corrections in persistent memory.

## Tool integrations

A support agent is most effective with:
- **GitHub CLI** (`gh`) for issue/PR management
- **Linear API** for internal ticket tracking
- **Discord/Slack/Telegram** via LettaBot for multi-channel presence
- **Web search** for docs verification
- **Bash** for investigating repos, running reproductions

## Scaling

- **5-15 system blocks** is the practical sweet spot. More than 20 suggests content should move to reference files.
- **User files** scale linearly. Hundreds of user files work fine since they're read on demand.
- **Active issues** should be pruned regularly. Move resolved issues to an archive or delete them.
- **32k context window** recommended. Larger windows are slower and less reliable.
