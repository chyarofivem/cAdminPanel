# Agent memory

Short, durable notes for AI agents and maintainers working on this repository, one fact per file.
Read this index at the start of a session (AGENTS.md links here). Product invariants, commands and
conventions live in AGENTS.md and docs/; these files only hold what those do not.

When you learn something non-obvious that the next session would otherwise rediscover the hard way,
add a file here (frontmatter: `name`, `description`, `metadata.type` of user, feedback, project or
reference) and one line below. Update or delete a note that turns out to be wrong.

- [Git identity is unset](git-identity-unset.md): commits on the maintainer's workstation need per-command `-c user.name`/`-c user.email`.
- [Pushes need `--no-verify`](git-push-needs-no-verify.md): `.husky/pre-push` execs bun, which is not installed there.
- [Scripted edits break quietly](crlf-script-edits.md): CRLF files, heredoc escapes and shell quoting; prefer the Edit and Write tools.
- [Previewing UI without the game](ui-preview-without-game.md): browser-mode NUI on mocks, the panel needs the backend, and CEF (Chrome 103) limits.
- [The user tests UI themselves](user-watches-ui-live.md): give the dev-server commands early, keep a runnable state, never install browsers or screenshot tooling.
- [The 2026-10 design-system rebuild](design-rebuild-2026-10.md): why the panel and in-game menu look the way they do, and what was removed on purpose.
- [FXServer artifact sources](fxserver-artifact-sources.md): the runtime.fivem.net index now redirects to docs; `server.zip` still downloads; the changelog API is the stable source.
