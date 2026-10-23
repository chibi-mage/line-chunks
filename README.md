# MDPF Editor for Forge Neo

Private Forge alpha · **0.48.2-alpha.1** · packaged 2026-10-23

Review and organize positive prompts in Forge's original txt2img and img2img textboxes. MDPF adds colored section headings, manual line labels, scored suggestions, and an organization preview with explicit Apply/Revert. Typing, resizing, selection and Tag Autocomplete use the native textbox.

The primary goal is visual MDPF comprehension, followed by writing assistance. Automatic organization is a conservative convenience; tangled prompts can need manual rewriting or an LLM-assisted draft that the user reviews.

Resizing with MDPF active is confirmed by the owner. Optional draft saving has a reported incomplete-save issue and is low priority; see the [known issues](https://github.com/chibi-mage/mdpf-editor/blob/main/docs/known-issues.md). It does not block visual prompt editing.

**BREAK import · confirm blocks** adds a reviewed workflow for structured multi-character imports. Detect row-leading BREAK blocks, review every Shared/Character role, confirm, Preview and Apply. Shared text/references and BREAK delimiters stay locked; character blocks organize L3–L7. Two to eight owners, up to four shared blocks, explicit counts and existing size limits apply. Auto Fix ownership limits are unchanged. Bounded color/material/modifier phrases for 48 known outfit nouns now classify as L4 with existing body-area ranks; supported verb-object actions remain L2.

**Auto Fix** organizes eligible solo prompts and configured Basic Forge Couple prompts in one click. Each editable character region needs one explicit `1girl`, `1boy` or `1other` tag. Couple mode requires enabled Basic assignment, exact standalone `---` separators and a readable Global Effect position. Shared text, region order and BREAK membership are preserved. Manual line labels take priority; unknown strings/standalone LoRAs may use provisional L7. Ambiguity or unsupported syntax blocks the whole write. **Revert Auto Fix** restores the exact original while its snapshot remains current. Couple settings are read only.

After Auto Fix, a compact result row appears directly below the MDPF toolbar, above the original prompt. It shows organized item, removed duplicate and unknown-to-L7 counts. **Details** expands a read-only placement/duplicate audit; **Revert Auto Fix** uses the existing exact guarded undo. Blocked attempts show their reason and **Open review**. Changed prompt text marks the previous result as historical. Summary controls never become prompt text.

In **Organize → Select items**, select individual preview entries or **Select shown items**, choose **Move selected items to**, then **Set destination → Preview organization → Apply organization**. Use **All items** to correct recognized tags. Manual labels, verified bundles and removed repeats are protected. Choices are local to the current prompt/session; no classifier training or saved global overrides.

Templates below the prompt now emphasize **Start from a template** for an empty prompt, or **Add character** and **Save / load draft** for an existing draft. Full replacement remains collapsed and requires explicit confirmation. Section expansion choices and focused controls survive background updates.

## Start here

New to MDPF? Follow the [five-minute starting guide](docs/user-guide.md#five-minute-starting-guide).

- [Installation, updates and removal](docs/installation.md)
- [Using MDPF](docs/user-guide.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Known limitations](docs/known-limitations.md)
- [Portable core and future ComfyUI adapter](docs/portability.md)

L1 Quality & medium; L2 Camera, pose & action; L3 Character; L4 Outfit; L5 Gaze & expression; L6 Background; L7 Style. Labels are visual metadata, not generation tags. Explicit compact formatting can add real blank heading rows. Organize writes after Apply; Auto Fix is a separate explicit one-click write.

`newest` is a strong L1 quality tag. Bare `action` is deliberately ambiguous between L2 pose/action and L7 style: choose its intended placement in Assign line or Organize. It has no automatic or tentative destination.

Unknown strings and possible LoRA triggers may receive provisional L7 placement. This is a review fallback, not evidence that the classifier understands them. Review proposals before applying them.

Pony `score_1` through `score_9`, with or without `_up`, are recognized as L1 quality tags. Organize and Auto Fix put standalone scores first in descending numeric order, preserving spelling/suffixes and equal-score order. Protected weighted groups and verified bundles remain intact. Detection and typing do not reorder text.

Recognized head, face and neck accessories now default to **L4 Outfit**, including hats, crowns, helmets, veils, circlets, glasses, facial piercings, masks, earrings, collars, chokers and hair adornments. Common qualified forms such as `silver earrings`, `gold crown` and `round glasses` are included. This supersedes the earlier accessory ambiguity policy. Explicit line labels and verified bundles retain their chosen placement. Mixed weighted groups remain intact and require review.

Recognized `covered [body part]` tags default to **L4 Outfit**, including `covered face`, `covered neck`, `covered breasts`, `covered nipples` and `covered eyes`. `Covering [body part]` tags belong to **L2 Pose/action**, including `covering privates`, `covering own mouth` and `covering breasts`. The matching is limited to body-part phrases, rather than arbitrary words after “covered” or “covering.” Explicit hair occlusion and closed eyes keep their appearance/expression categories.

Simple and recognized color backgrounds belong to **L6**. Cinematic/volumetric/anime lighting, ray tracing, dramatic shadows, anime screencap and anime coloring belong to **L1**. Common pupil modifiers and hairstyles, including white pupils, antenna hair, Japanese ahoge and French braids, belong to **L3**. Organize/Auto Fix place plain automatic pupil modifiers after the last recognized eye-color tag within their L3 run, respecting manual labels, weighted groups, bundles, owner and BREAK boundaries. Hair precedes the eye/pupil group even without an eye-color anchor. Typing and detection do not reorder tags.

A reviewed 214-tag pool covers profession costumes and armor (**L4**), sitting/leaning poses (**L2**) and furniture/architecture/scenery (**L6**). Knight, nun, prisoner, breastplate, chainmail, gauntlets and bracers are L4; crossed legs and sitting on throne are L2; throne, pillar, stone wall and castle are L6. These are whole-tag conventions, with bounded color/material armor forms, rather than inference from arbitrary role or object words.

A fresh mixed-prompt audit corrected 31 semantic gaps, including actions such as `brushing hair`, `holding hat` and `pulling shirt` that previously inherited appearance/outfit suffix evidence. Blouse/nightgown/sundress and hood states are L4; long eyelashes/scar on face are L3; sleepy is L5; rain/tatami/gate/flower field are L6. Bounded action phrases take priority over generic hair/garment rules; complete garment prints and unknown triggers retain their existing behavior.

An audit of 16 user-supplied PNG positives adds 60 clear category mappings and two explicit ambiguities. Examples include hair buns/topknots and body freckles (L3), garment construction and worn accessories (L4), crossed arms/V gesture (L2), expression phrases (L5), colored scene effects (L6) and known painting/texture terms (L7). Sketch remains L1/L7; the earlier gold-bracelet ambiguity is superseded by the whole-body Outfit policy. Names, broad mood terms and unverified triggers remain provisional; differences from a manually fixed example do not silently become global rules or wording substitutions.

Recognized worn accessories across the body belong to **L4 Outfit**, including bracelets, rings, cuffs, anklets, socks and body jewelry. Bare shoulders/arms/legs/back/midriff and reviewed clothing cutouts/holes also belong to L4. This supersedes earlier wrist/accessory/exposure ambiguities. Body features such as broad shoulders, cleavage and navel stay L3; dressing/adjusting/removal actions stay L2. Manual placements and verified bundles retain priority.

Organize/Auto Fix put an existing plain `1girl`, `1boy` or `1other` first, followed by existing `solo`, within each automatic unprotected L3 run. The remaining reviewed traits follow identity, hair, eyes/pupils, face, build/skin, torso, arms/hands, lower body and natural appendages. Equal categories retain source order. No count or solo tags are invented. Manual placements, verified bundles and weighted/opaque groups are ordering barriers; owner, BREAK and shared boundaries stay protected. Typing and detection do not reorder text.

Body/skin marks, makeup, nails and natural claws/ears/horns/tails belong to **L3**. Explicit fake features and claw gloves belong to **L4**; claw/paw/rabbit poses belong to **L2**. Recognized L3 descriptors now follow the complete appearance order, respecting the same protection barriers. Generic marks join the build/skin group without guessing a specific body site; natural ears/horns/tails/wings form the final appendage group. Unranked L3 descriptors also stop sorting.

L4 clothes and accessories now sort together from head to feet. General states (`nude`, `wet clothes`, `torn clothes`) lead, followed by unlocated details, head, face, neck/shoulders, torso, arms/wrists/hands, waist/hips, thighs/legs/ankles, feet and then weapons/carried accessories. Equal-area tags retain source order; manual, weighted, bundle, unranked and scope boundaries remain protected.

The combined appearance audit adds exact L3 mappings for `cat paws`, `fluffy ears` and `demon girl`, and L4 mappings for `hair tie`, `fur collar`, `arm guards` and `knee guards`. Existing scope/size limits remain in place; detailed prompts can reach the 200 editable-item limit before eight owners.

Body/subject focus tags such as `face focus`, `back focus`, `ass focus`, `male focus` and `female focus` are **L2**, as are `portrait` and reviewed framing formats. Emotions and facial eye/mouth actions belong to **L5**. Organize/Auto Fix put recognized gaze directions first within each automatic unprotected L5 run, retaining the order of multiple gazes and the remaining expressions.

A targeted boundary audit adds 26 L2 interaction tags (including hand/arm eye shielding, wiping tears, face contact and head turns) and nine L5 facial states. `Hand over eyes` is L2, `closed eyes` L5, `covered eyes` L4 and hair occlusion L3. Exact overrides correct tested eye-suffix collisions without broadening generic patterns.

Pair L2 interactions with object descriptions: `sitting on throne` in L2 plus `ornate throne` in L6; `holding chair` in L2 plus `wooden chair` in L6. Recognized weapons/carried accessories such as `silver sword` or `red umbrella` use the final L4 group after footwear, while their holding action uses L2. Explicit scene forms such as `beach umbrella` stay L6. No missing descriptions are automatically added.

Ruleset 0.1.32 contains 1318 exact rules (including 231 historical curated mappings) and twenty-one anchored patterns. Recognized jewelry/wrist accessories and garment exposure/cutout states default to L4. Ambiguous eye states and unreviewed phrases can still need context. Existing scoring thresholds are unchanged. Historical review records and baseline fixtures remain frozen; current evaluations explicitly apply the author's accessory policy revision. Vocabulary popularity came from a local historical Danbooru snapshot, not a current popularity survey.

## Compatibility and scope

Validated on Forge Neo commit `cb3c1fc535482003156e1c00ffe9802eeea92e97`, Gradio 4.40.0. Other Forge builds and themes need testing. This is not yet an A1111 or ComfyUI release. Negative and ADetailer prompts are outside scope. MDPF does not load models, configure Forge Couple or change generation settings. No prompt telemetry or automatic training is included.

The runtime contains 14 JavaScript modules and one stylesheet, with no extra runtime dependencies or bulk external tag dataset bundled. Original extension code is licensed under the [MIT License](LICENSE), as selected by the owner. Private alpha describes the testing stage, not an additional redistribution restriction. External datasets and private reference fixtures are excluded from the installable package; this license does not establish rights to separately sourced material.

## Development

This clean source candidate includes a self-contained neutral regression subset. Run `npm test` with Node 18+; no dependency installation is needed. Use Python 3.9+ for `python tools/test_package_alpha.py` and `python tools/package-alpha.py`. See CONTRIBUTING.md for source boundaries and release expectations.

The private workspace's larger evaluation suite, supplied PNG metadata, personal prompts, external vocabulary catalogs, outputs and backups are intentionally excluded. Runtime modules match the workspace baseline; README/package scripts are adjusted for this subset. The generated repository-candidate-manifest.json records exact file hashes. Source home: [chibi-mage/mdpf-editor](https://github.com/chibi-mage/mdpf-editor).

## Blank starters

Open **Organize · prompt preview** below the positive prompt, then select the **Templates** tab. The neighboring **Organize & review** tab holds the existing preview and organization controls. Switching tabs preserves choices and never edits the prompt. Choose **Solo**, **Two characters · placement line**, or **Forge Couple · multi-character**. The outline previews section labels and the few starter tags that will be inserted. Nothing changes until **Insert template**. If a draft exists, explicitly check **Replace the current draft** first. **Undo template** restores the exact previous source while the inserted result is still current; subsequent edits disable that undo.

Solo starts with `1girl, solo,`. The ordinary two-character starter uses shared L1/L2, C1 L3/L4/L5, `man next to girl,` as a placement line, C2 L3/L4/L5, then shared L6/L7. Its default counts are `1girl` and `1boy`; edit counts and placement for your scene. The second expression row is optional: leave it empty when sharing the main expression. Distinct expressions can bleed; regional conditioning or later inpainting may help.

Forge Couple supports **2–8 characters**, with Shared region **First / Last / None**. Every character starts with editable `1girl,` and blank L4/L5/L6 rows. Shared First/Last adds blank L1/L2/L6/L7 sections. Literal `---` rows divide regions. Match the separator and Global Effect position in Forge Couple yourself. Insertion never enables, configures or resizes Forge Couple regions.

Empty sections have visual labels and real blank rows, without placeholder quality/appearance/LoRA tags. Type directly in the original textarea; autocomplete, selection and resizing continue there. Blank labels and starter ownership metadata survive normal same-line typing and Detect in this page. They are page-local unless explicitly exported and reopened using Save / load draft: reloading, external replacement, edits across sections or Reset labels can remove them. Within a known template section, Enter and multiline paste continue that section and character, with one heading; joining its own continuation rows preserves the label. Empty content rows remain editable slots. Pasted control markers and edits across headings/owners do not inherit a section. Source text remains intact; use Detect/Assign line for a completed prompt. Turning MDPF off hides decorations, not source rows.

## Add a character without replacing the draft

Under **Organize · prompt preview → Templates → Add character to this draft**, choose Ordinary or Forge Couple, the new count tag (`1girl`, `1boy`, `1other`), and either an editable placement line or the existing shared-region position. **Preview added character** shows the exact complete proposed prompt without writing. **Add character** applies that proposal. Changing source, labels, options or Couple settings requires a new preview.

Ordinary insertion needs labeled L3 count lines. It inserts a placement line and blank L3/L4/L5 before the trailing shared L6/L7 sections, or appends when no shared tail exists. Couple insertion needs standalone `---` boundaries, exactly one explicit single-character count per existing owner region, and the correct Shared First/Last/None position. It adds L3/L4/L5/L6 while preserving the shared chunk position. When Couple is enabled, its Basic mode, separator and shared position must match; the extension never changes those settings.

Existing source text, LoRAs, continued sections and manual labels are retained. No existing `solo` or aggregate count tag is silently removed or updated: fix those for the new scene yourself, and configure the new Forge Couple region manually. **Undo added character** restores the exact previous draft while the inserted result remains current; later text edits disable that undo. The workflow supports up to eight characters. Raw/unclear ownership, mixed separators, competing owner counts, BREAK/advanced controls and composition in progress require manual completion or another supported layout.

## Save and reopen a draft

Open **Organize · prompt preview → Templates → Save / load draft**. **Save draft file** downloads `mdpf-draft.json` with the current positive prompt, section/character labels, empty slots, continued sections and editor display preferences. Save explicitly before reloading; there is no automatic recovery or browser storage. Rename or move downloaded files yourself as desired.

Choose an **MDPF draft file** to read and preview it locally. The preview shows the exact incoming prompt and a line/label summary; choosing a file does not change the current draft. Check **Replace the current prompt and labels with this draft** when a draft already exists, then select **Load draft**. If your current prompt, labels or editor state change, select **Preview draft** again. Invalid/unsupported files leave the current draft untouched. **Undo loaded draft** restores the exact previous source, labels and display preferences until another text/label/editor edit changes the loaded result.

Save/load works independently in txt2img and img2img and supports moving a draft between them. It does not save models, seeds, generation settings, classifier changes, pending organization choices or Undo history. Forge Couple guidance is only a separator/shared-position reminder; loading never enables or configures Couple. Generation metadata remains plain prompt text; the JSON labels are never inserted into it.

Version 1 files use LF newlines and allow up to 100,000 prompt characters, 10,000 source rows and 2 MB of JSON. Files are validated before Load is enabled. Unsupported schema versions require a compatible extension version rather than silently losing labels.
