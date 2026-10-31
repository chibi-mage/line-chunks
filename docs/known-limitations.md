# Known limitations — 0.50.0-alpha.1

Updated 2026-10-31. This is a public alpha for readable main positive prompts, writing assistance and conservative optional organization.

## Host and editor scope

- Tested on Forge Classic/Neo, branch neo, commit `2900d5948a17ec993075fb810a695ce4f674bd0c`, Gradio 4.40.0. Other hosts, themes, A1111 and all browser/scroll combinations need validation. ComfyUI is outside this project.
- Only the main txt2img/img2img positive prompts are supported. Negative, ADetailer and other textboxes remain manual. The extension does not change models or generation settings.
- The native textarea remains the editor. Compact display reserves real blank heading rows; these appear in copied prompts and saved generation text. Typing and background observation do not add rows. A wrapped row is not an extra Line Chunk.
- Section labels describe structure, not proof that every tag is correctly placed. Manual labels and blank template slots are page-local unless saved in a draft file. Splitting/joining across sections, external replacement, Reset labels or reload can clear unsaved metadata.

## Classification and organization

- Ruleset **0.1.38** contains **1,593 exact rules and 28 patterns**. The vocabulary is reviewed but incomplete. Manual placement does not train it. Unknown names, random triggers and unverified standalone LoRAs can receive provisional L7; this does not establish that they are style tags or identify a LoRA’s role.
- Organize provides a proposal with item destinations and duplicate review before Apply. Auto Fix applies eligible plans immediately. An uncertain or unsupported editable item can block the entire change. The extension cannot reliably repair every tangled imported prompt; manual editing remains useful.
- Auto Fix requires one explicit plain `1girl`, `1boy` or `1other` per editable owner. Solo and configured Basic Forge Couple are supported. Couple requires exact standalone `---`, readable Global Effect first/last/none, disabled Tile Mode and no active unsupported Common Prompts constructs. Couple settings are read only. Advanced/Mask/custom/newline layouts need a supported reviewed workflow or manual editing.
- Reviewed multi-character organization supports two to eight explicit character blocks. Row-leading BREAK import requires confirmed block roles and matching counts. BREAK alone does not establish ownership. Embedded middle-row BREAK and other complex controls can block organization.
- Limits are **20,000 source characters and 200 editable items total**, including multi-owner prompts. Eight detailed characters can exceed the total. An intact weighted group counts as one item. Unsupported syntax, malformed groups, schedules, dynamic constructs, cross-line groups and unclear ownership can require manual work.
- Exact plain duplicates are removed only within the same destination, owner/region and BREAK segment. Shared text, weighted groups, LoRAs and verified bundles retain their safeguards. Intentional repeats can be kept in review; no synonym merging is performed.
- Character and outfit ordering is assistance, not a full language parser. Manual, weighted, bundled, unranked and opaque items can stop sorting. Equal-area order remains stable. Clothing layers, conflicting descriptions and garment-detail relationships are not fully inferred. L5 gaze directions lead automatic plain runs, but conflicting gazes/emotions are preserved.
- Bare reviewed vegetation defaults to L6; explicit worn vegetation/costume forms use L4 and reviewed actions use L2. Natural body features use L3; explicit fake/costume forms use L4. Unreviewed phrases may still be unknown. Action remains an intentional L2/L7 ambiguity.
- Reviewed weapons and carried umbrellas use the end of L4 after footwear; scene furniture remains L6 even when its interaction is L2. The extension does not invent holding actions, bind object attributes or synthesize missing descriptions.
- Source-preservation safeguards do not promise identical generated images after ordering or duplicate removal. Multi-character appearance/expression bleed depends on conditioning. Forge Couple or later inpainting may help; editor labels do not isolate characters.

## Templates, drafts and Undo

- Starters cover solo, ordinary two-character placement layouts and two to eight Forge Couple characters. They do not configure conditioning. Update counts and placement text for the intended scene.
- Add character is insertion-only and leaves existing solo/aggregate counts unchanged. BREAK/custom separators and unclear ownership may require manual editing. New characters can exceed the organization item limit.
- Draft files save exact source, labels and display preferences, using the compatible `mdpf-draft` schema v1. They do not include generation settings, pending organization choices/bundles, auto-save or permanent Undo history. Saved Couple hints do not configure the host.
- Apply/Revert and spacing Undo use exact snapshots. Subsequent edits can invalidate them; retain your own prompt or draft when you need lasting recovery.

## Evidence and remaining checks

Native autocomplete, physical resizing, txt2img/img2img mounting, Auto Fix/Revert, stale-preview protection, and a four-character Basic Couple workflow passed focused SD9 checks. The owner also confirmed draft file saving. Automated portable/controller tests exercise labels, drafts and source guards. These results do not establish every browser, theme or generation workflow.

Populated-style application, image-upload transfers and generation were not rerun during the branding/public-packaging passes. Prior notes include a stale negative token-count badge after host Clear; the negative source was empty, and attribution was not isolated. No blocking extension bug was reproduced in the current checks. See [Troubleshooting](troubleshooting.md); the source repository also records the detailed host checks.

Original extension code is MIT licensed. Bulk external vocabularies, supplied image metadata and private reference fixtures are excluded from the distribution.
