# Known issues and priorities

Updated 2026-10-29 for MDPF 0.49.5-alpha.1. The newer SD9 Forge Neo build 2900d59 has a focused [host compatibility record](host-compatibility.md).

## Draft saving confirmed by the owner

Draft file saving is confirmed working by the owner's further testing on 2026-10-23. The earlier incomplete-save report is resolved on that basis; no code fix or independent browser save/reload verification is claimed.

Portable serialization and controller tests also pass. Save/load remains optional: draft files preserve prompt text and labels, while page-local Undo and pending organization choices are excluded. No further owner retest is requested.

## Resizing accepted

The owner directly confirmed that resizing with MDPF active works well. This does not establish every browser, theme or viewport.

## Remaining verification limits

Populated-style application remains unverified because the Styles list was empty. The previous img2img clear limitation was resolved by a successful native clear check on SD9 (2026-10-29); no code fix was needed. Native infotext replacement, stale-preview blocking and exact Auto Fix Revert also passed live checks. Image-upload transfers and generation remain outside this compatibility pass. Minor observations, including a stale negative token-count badge after host Clear, are recorded in host-compatibility.md. No blocking MDPF runtime issue was reproduced.

## Product priorities

Keep native positive-prompt readability first, writing assistance second and conservative organization third. Reproduce concrete bugs before changing runtime behavior. ComfyUI is outside this project and would be separate if pursued.
