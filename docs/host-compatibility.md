# Forge host compatibility

## Current installation check — 2026-10-29

MDPF 0.49.5-alpha.1 was installed from its verified private-alpha package into `E:/SD9/sd-webui-forge-neo/extensions/mdpf-editor`. This was a new extension installation in the SD9 folder, followed by Forge's Reload UI while idle. No runtime patch was needed.

| Environment | Previous baseline | SD9 check |
| --- | --- | --- |
| Repository | Haoming02/sd-webui-forge-classic | Haoming02/sd-webui-forge-classic |
| Branch | neo | neo |
| Commit | cb3c1fc535482003156e1c00ffe9802eeea92e97 | 2900d5948a17ec993075fb810a695ce4f674bd0c |
| Gradio | 4.40.0 | 4.40.0 |
| Python | 3.13.12 | 3.11.9 |
| Torch | 2.10.0+cu130 | 2.14.0+cu130 |

The SD9 launcher is `webui-user.bat`; the tested address was `http://127.0.0.1:7860/`. Environment versions above came from the running UI footer. This records these builds only; it is not certification of every Forge Classic branch or future update.

### Live checks that passed

- One MDPF controller for each main txt2img/img2img positive textarea; no duplicate mounts after tab changes.
- Compact colored display, seven section headings, Auto Fix grouping, duplicate summary, exact Revert, and stale-result invalidation after editing.
- Tag Autocomplete suggestions and Tab acceptance inside active L3 text. Ordinary typed-character undo/redo and token-count updates worked.
- Physical native resize from 314 to 421 pixels, then restored, without changing source text. The first drag used scaled screenshot coordinates and missed the handle; the successful drag used measured viewport geometry.
- img2img has an independent editor, grouping and compact view. Native clear emptied it after its confirmation. txt2img clear also emptied both prompt fields and removed template labels.
- Forge's parameter-read button replaced positive/negative source from synthetic infotext. MDPF invalidated the old result and organized the replacement correctly.
- Reviewed Organize proposal enabled Apply; further typing disabled stale Apply.
- Solo blank template insertion and continued character typing across Enter retained the same L3 section; autocomplete remained available.
- Basic Forge Couple v7.1.0 with exact standalone `---`, a first shared chunk, four character chunks, blank rows and a standalone BREAK: shared text and cross-owner/cross-BREAK repetitions remained; one same-scope duplicate was removed. Detect / View activated compact regional display and C1–C4 headings. Disabling Couple blocked regional Auto Fix.

Temporary Couple controls were restored to Enable off, empty separator and Global None. No settings were saved, no model selection changed, and no images were generated. A UI reload naturally rebuilds session controls from Forge defaults; it is not a promise to preserve every unsaved UI setting in other tabs.

### Limits and observations

- Styles had no populated entries, so populated-style application remains unverified. No persistent test style was created.
- PNG Info image upload, output-image Send to img2img and actual generation/conditioning were not exercised. Native infotext parsing is a separate tested path, not a substitute claim for those image flows.
- Completion-replacement undo was not established; the verified undo/redo case was ordinary typed text. Existing owner acceptance of draft-file saving was not repeated.
- After regional BREAK, a continuation containing only `blue hair` remained one explicit unassigned label suggestion while the other C1–C4 sections displayed correctly. No ownership or destination was guessed for that row.
- After txt2img Clear, negative source was empty but its token badge retained the prior 7/75 count. This was an observed host-field display inconsistency; no MDPF negative-prompt processing is performed. It did not leave text in the negative prompt. Attribution was not separately tested with MDPF uninstalled.
- Browser console contained Gradio Example.svelte element-not-in-DOM errors around UI reload. No MDPF-tagged warning/error was observed. This does not establish that all unrelated extension errors were audited.

No blocking MDPF compatibility issue was reproduced in this pass. Raw synthetic test notes and screenshots stay in the private workspace; only this neutral record enters the clean source repository.
