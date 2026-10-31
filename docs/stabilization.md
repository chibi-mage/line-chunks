# Normal-use stabilization

Baseline: 0.50.0-alpha.1. Keep this version as the normal-use baseline; do not add features or broaden classification rules during this phase without a concrete need.

Use Forge normally. There is no daily checklist, deadline, automatic monitoring or request to repeat earlier acceptance tests. Draft saving and native resizing are accepted from the owner's successful testing. Automated evidence and live-check limits are recorded separately in known-issues.md and baseline-acceptance.md.

## When something goes wrong

Open the repository's Issues page and choose **Bug report**, or describe it in the development chat. State what you did, what you expected and what happened instead. Add the Line Chunks version and host/browser details if available. A short neutral prompt is enough when the issue depends on tags; no full image collection, draft file or logs are required.

The form prepares a report only. It sends nothing until the user submits it. Review any optional prompt or attachment before sharing it. Reports follow the repository's visibility and access settings.

## How a report becomes a fix

1. Reproduce the behavior with the smallest useful prompt and identify whether it comes from Line Chunks, the host or an interaction between extensions.
2. Add a regression for a confirmed Line Chunks bug. Preserve prompt text, section/character ownership, native completion and exact Apply/Revert guards.
3. Make the smallest correction, run relevant checks and existing release checks, then publish a patch after successful CI. Keep a rollback package.
4. Record what was tested and what remains unverified. Do not describe a browser-control failure or unsupported host as a reproduced extension bug.

## Public alpha

0.50.0-alpha.1 is the first Line Chunks public alpha. Installation uses the named Forge ZIP and checksum in GitHub Releases. The guide introduces it as an optional positive-prompt editor. Keep compatibility claims tied to the tested Forge Classic/Neo build; A1111 and other builds remain unverified.

Public availability invites feedback; it does not establish a representative accuracy score or a completed observation period. Prioritize reproduced bugs and installation problems. Further vocabulary additions can ship as separate reviewed updates. ComfyUI remains outside this project.
