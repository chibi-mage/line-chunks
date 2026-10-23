# Troubleshooting

| Symptom | Check or action |
| --- | --- |
| No controls | Check folder nesting, enable the extension, restart Forge and save drafts before Ctrl+F5. The host must support `.mjs` extension scripts. |
| Old/inconsistent controls after updating | Close Forge, replace the entire extension folder from one package, restart and hard-refresh. Avoid mixed module versions. |
| Wrong label | Structural mapping and semantic scoring differ. Inspect Assign line evidence and choose a manual label. Mixed/unknown tags can remain unresolved. |
| Large section gaps | Extra authored blank rows are preserved. Inspect raw text with mode off; save it before changing whitespace, especially with regional separators. |
| Autocomplete fails | Compare with MDPF off in the same textbox. Check Tag Autocomplete's settings and host support. Other builds/themes remain unverified. |
| Apply disabled | Confirm ownership, resolve placements/bundles, finish text composition and Preview again. Source, label or choice changes invalidate an older proposal. Inspect displayed syntax errors. |
| Revert/Undo spacing unavailable | Its exact snapshot no longer matches. Restore your saved draft; old snapshots cannot overwrite newer edits. |
| Intentional repeat removed | Inspect duplicate cleanup and Keep the occurrence before re-previewing. If already applied, Revert while available. Cross-owner/BREAK repeats are protected. |
| Couple output/expressions wrong | Check Couple's configuration and generation workflow. MDPF does not set masks or conditioning, and text grouping cannot guarantee separate expressions. |

For a private test report, include the MDPF version, Forge build, theme/browser, action and expected/actual result. Share only the smallest positive prompt needed. Remove private information you do not want to share. No report is sent automatically.

If a preview item cannot be selected, check whether it belongs to an explicit line label, a verified bundle, or a repeated occurrence marked for removal. Reset the line label, remove the bundle, or Keep that repeat first, then preview again. If Set destination is disabled, select an eligible item. After setting destinations, a fresh Preview is required before Apply.

For BREAK imports, choose the import scope and Detect candidate blocks before confirming. Source/role changes clear confirmation; redetect after Apply or replacement. Keep shared quality/camera text in Shared blocks, start each Character block with its explicit count, and resolve count disagreements manually. A clothing phrase provisionally in L7 can be selected and moved to L4 in the review; trigger associations still need deliberate verified bundles.
