# Contributing to MDPF Editor

MDPF first makes main positive prompts easier to read, then assists writing, and finally offers conservative organization. Keep the native Forge textarea, autocomplete, selection and resize behavior. Negative and ADetailer prompts remain outside scope.

## Development

Use Node 18 or later for `npm test`; no dependency installation is needed. Python 3.9 or later runs `python tools/test_package_alpha.py` and `python tools/package-alpha.py`. The clean repository candidate includes a self-contained neutral regression subset. The private development workspace has a larger suite with reference fixtures that are not distributed.

Forge CI runs the neutral tests and packaging checks on Windows and Linux. A separate package job waits for every matrix check, then uploads the Forge ZIP and checksum. See docs/ci.md for download and failure instructions. A green run is automated regression evidence, not a resolution of known live issues.

Change portable planning/scoring independently of host UI. `docs/portability.md` describes the boundaries and draft schema for a future ComfyUI adapter. Do not claim ComfyUI compatibility from portable-engine tests alone.

Retain explicit ownership, BREAK/regional scopes, manual-label and opaque/weighted-group barriers, duplicate audits, composition guards, exact-source Apply/Revert checks and stale-preview invalidation. Unknown triggers are not evidence of LoRA ownership. Never synthesize absent tags or change generation settings to make a test pass.

For a fix, add a small meaningful regression that demonstrates the failure and verifies preserved source or scope. Generated vocabulary rules should be reviewed as complete tag decisions, not inferred from substring matches. Do not silently import a third-party dataset or alias table.

## Reporting a problem

Include extension version, Forge build, browser, the action that caused the issue and expected/actual behavior. Prefer a short neutral synthetic prompt. Check prompts, screenshots and draft JSON for private information before sharing. A visual label is not proof that every tag belongs in its section, and automated coverage is not an image-quality benchmark.

## Licensing and release scope

Original extension code is MIT licensed; retain its notice. The bulk Tag Autocomplete/Danbooru vocabulary, local intake catalog, supplied PNG metadata, private prompts and backup/history files are excluded from the clean handoff. Third-party material needs its own provenance and applicable terms; this project's license does not establish those rights.

The current Forge baseline is for visual/writing use. The owner confirmed physical resizing. Optional draft saving has a reported incomplete-save issue and is not a publication gate; see docs/known-issues.md. Do not claim it fixed from offline tests alone. An installable package is produced by an explicit allowlist and a SHA-256 manifest. Keep source packages and installable Forge packages separate.
