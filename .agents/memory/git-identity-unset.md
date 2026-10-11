---
name: git-identity-unset
description: No git user.name/user.email is configured on the maintainer's workstation; commits need -c flags with chyaroscuric <chyaroscuric@gmail.com>.
metadata:
  type: project
---

The maintainer's Windows workstation has no `user.name` or `user.email` in any git config, so
`git commit` fails with "Author identity unknown". Every commit in the repository is authored by
`chyaroscuric <chyaroscuric@gmail.com>`.

**Why:** Guessing an identity would bake a wrong author into public history, and changing git config
is off limits, so the identity comes from the repository's own history and is passed per command.

**How to apply:** Verify with `git log -1 --format='%an <%ae>'`, then commit or tag with
`git -c user.name='chyaroscuric' -c user.email='chyaroscuric@gmail.com' ...`. Do not run
`git config`. Only commit when the user asks. See also [[git-push-needs-no-verify]].
