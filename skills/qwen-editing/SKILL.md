# Qwen 3.5 Editing Strategies

This skill provides optimized strategies for file editing when running Qwen 3.5 (397B or smaller variants). Qwen models can struggle with exact string reproduction required by the Edit tool. These patterns minimize failures and provide reliable fallbacks.

## When to load this skill

Load automatically when the active model is a Qwen variant and you need to edit or write files.

## Core Principle

The Edit tool requires `old_string` to be an **exact, character-for-character match** of text in the file. Qwen models sometimes introduce subtle differences (whitespace, punctuation, casing) when reproducing existing code. Every strategy below is designed to reduce or eliminate the need for verbatim reproduction.

---

## Strategy 1: Always Read Immediately Before Editing

NEVER edit from memory. Always Read the file in the same turn, immediately before calling Edit.

**Why:** Qwen's reproduction accuracy drops significantly when working from recalled context vs. text that was just returned by a tool in the current turn.

**Pattern:**
1. Read the file (or the relevant line range)
2. Identify the exact lines to change
3. Use the smallest unique snippet as `old_string`
4. Call Edit immediately -- do not call other tools between Read and Edit

---

## Strategy 2: Minimize old_string Length

Use the **shortest unique string** that identifies the edit location. A single distinctive line is better than a multi-line block.

**Bad -- too much text to reproduce exactly:**
```
old_string: "function calculateTotal(items) {\n  let total = 0;\n  for (const item of items) {\n    total += item.price * item.quantity;\n  }\n  return total;\n}"
```

**Good -- one unique line:**
```
old_string: "    total += item.price * item.quantity;"
new_string: "    total += item.price * item.quantity * (1 - item.discount);"
```

**If the single line is not unique in the file**, add just enough surrounding context (one line above or below) to make it unique.

---

## Strategy 3: Use Write for Small Files

If the file is under ~100 lines, prefer the Write tool to rewrite the entire file rather than surgical Edit. This completely eliminates the exact-match problem.

**When to use Write over Edit:**
- File is under 100 lines
- You are making multiple edits to the same file (3+ edits)
- Previous Edit attempts on this file have failed

**Pattern:**
1. Read the entire file
2. Reproduce the full content with your changes applied
3. Write the complete file

**Caution:** For files over 100 lines, Write becomes risky -- Qwen may introduce unintended changes in sections you meant to leave alone. Stick to Edit for large files.

---

## Strategy 4: Line-Number-Based Sed Fallback

When Edit fails repeatedly on a specific string, fall back to `sed` via the Bash tool using line numbers. This requires zero string matching by you -- only line number identification.

**Pattern:**
1. Read the file to identify the target line number
2. Use sed with line addressing:

```bash
# Replace entire line 42
sed -i '' '42s/.*/    new content here/' /path/to/file.py

# Delete lines 10-15
sed -i '' '10,15d' /path/to/file.py

# Insert after line 20
sed -i '' '20a\
    new line content here' /path/to/file.py

# Replace a specific string on a specific line (safer than global)
sed -i '' '42s/old_pattern/new_pattern/' /path/to/file.py
```

**Note:** On macOS, `sed -i ''` requires the empty string argument. On Linux, use `sed -i`.

3. Read the file again to verify the change landed correctly.

---

## Strategy 5: Staged Multi-Edit Pattern

When making multiple changes to one file, do NOT batch them. Make one edit at a time with verification between each.

**Pattern:**
1. Read file
2. Make Edit #1 (smallest unique old_string)
3. Read file again to verify
4. Make Edit #2
5. Read file again to verify
6. Repeat

**Why:** If an early edit fails silently or introduces drift, subsequent edits against the expected file state will also fail. Verifying between edits catches problems early.

---

## Strategy 6: Handling Edit Failures

When an Edit call fails (old_string not found):

1. **Do NOT retry with the same old_string.** It will fail again.
2. Read the file to see the actual current content.
3. Check for these common Qwen reproduction errors:
   - Extra or missing whitespace (tabs vs spaces, trailing spaces)
   - Curly quotes vs straight quotes
   - Smart apostrophes
   - Off-by-one in indentation level
   - Missing or extra newlines at block boundaries
4. Try again with the corrected old_string copied more carefully from the Read output.
5. If it fails a second time, switch to the sed fallback (Strategy 4) or Write (Strategy 3).

**Do not attempt the same Edit more than twice.** Escalate to a different strategy.

---

## Strategy 7: Creating New Files

For new file creation, always use Write. There is no Edit concern since the file does not yet exist. Write the complete file content in one call.

---

## Quick Reference: Decision Tree

```
Need to modify a file?
  |
  +-- File < 100 lines? --> Use Write (rewrite entire file)
  |
  +-- File >= 100 lines?
       |
       +-- Single change? --> Read, then Edit (short unique old_string)
       |
       +-- Multiple changes? --> Staged multi-edit (one at a time, verify each)
       |
       +-- Edit failed twice? --> Sed fallback via Bash (line numbers)
```

---

## Verification Checklist

After ANY file modification (Edit, Write, or Bash/sed), ALWAYS:

1. Read the modified file (or the relevant section)
2. Confirm your change is present
3. Confirm no unintended changes were introduced
4. If the file is code, consider running the project's test suite or linter
