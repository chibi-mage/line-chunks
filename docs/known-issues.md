# Known issues and priorities

Updated 2026-10-23 for Forge baseline 0.48.2-alpha.1.

## Optional draft saving may not preserve the full existing prompt

The owner reports that saving a draft does not appear to save the complete prompt already in the textbox. Treat this as an unresolved live issue. It is low priority and does not block the extension's primary visual/writing use or the GitHub handoff. Do not require further owner testing as a release condition.

A focused offline controller check now captures the Blob prepared by Save and confirms its JSON `prompt` equals the complete current synthetic textbox text, without modifying that text. Portable draft validation/round-trip checks also pass. These results do not reproduce the live failure or prove it fixed. Browser file-transfer tests remain permission-blocked; no retry or alternate transfer route is used.

Until the live cause is understood, do not rely on this optional feature as the sole copy of an important prompt. Ordinary prompt text can be kept with the user's normal workflow. A future investigation should distinguish captured textbox source, downloaded file contents and selected file identity without asking the owner to repeat frustrating tests.

## Resizing accepted

The owner directly confirmed that resizing with MDPF active works well. This resolves the pending physical resize acceptance item. It does not imply testing every browser, theme, viewport or graph host.

## Product priorities

Focus maintenance on native typing/completion, wrapped-line readability, manual labels, resizing and exact Apply/Revert behavior. Reproduce a concrete issue before changing runtime behavior. Keep optional saving low priority.

Keep readable colored sections in the native positive prompt first, writing assistance second and conservative organization third. Save/load is optional. Do not add persistence complexity. ComfyUI is outside this project; any eventual port would be a separate project.
