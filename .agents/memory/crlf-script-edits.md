---
name: crlf-script-edits
description: The working tree is CRLF and the shell tool mangles some heredocs; scripted edits fail quietly, so prefer the Edit and Write tools.
metadata:
  type: feedback
---

Source files are checked out with CRLF line endings (`core.autocrlf=true`; the index stores LF).
During the 2026-10 design rebuild, scripted edits went wrong four ways:

- a multi-line `old` string never matched, because the file had `\r\n`;
- a `\\n` inside a heredoc became a real newline and split a TypeScript string literal
  (`join("\n")`, `replaceAll(/[\r\n]/g, '')`), which only surfaced at typecheck;
- long `cat <<'EOF'` batches whose content held backticks and quotes failed with
  "unexpected EOF while looking for matching `'`", sometimes after writing part of the batch;
- the same failure on a later batch wrote nothing at all.

**Why:** These failures are quiet: the script prints nothing, or the file compiles in an unrelated
spot, and the broken line is found much later.

**How to apply:** Use the Edit and Write tools for anything with backslash escapes, quotes or more
than a few lines. If a script must edit, read with `newline=''` (Python) and assert every pattern
matched. Run the workspace typecheck right after a batch of scripted edits. LF output is fine; git
normalises it.
