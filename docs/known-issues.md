# Known issues and priorities

Updated 2026-10-23 for Forge baseline 0.48.5-alpha.1.

## Draft saving confirmed by the owner

Draft file saving is confirmed working by the owner's further testing on 2026-10-23. The earlier incomplete-save report is resolved on that basis; no code fix or independent browser save/reload verification is claimed.

Portable serialization and controller tests also pass. Save/load remains optional: draft files preserve prompt text and labels, while page-local Undo and pending organization choices are excluded. No further owner retest is requested.

## Resizing accepted

The owner directly confirmed that resizing with MDPF active works well. This does not establish every browser, theme or viewport.

## Remaining verification limits

Populated-style application has not been live-verified because the inspected style list was empty. The last live img2img clear attempt stalled at its browser confirmation; it is unverified, not a confirmed MDPF defect. Controlled replacement, stale-preview and guarded-Undo tests pass. No confirmed runtime issue is currently listed here.

## Product priorities

Keep native positive-prompt readability first, writing assistance second and conservative organization third. Reproduce concrete bugs before changing runtime behavior. ComfyUI is outside this project and would be separate if pursued.
