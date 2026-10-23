# Using MDPF

MDPF helps write and organize the **main positive prompt** in Forge's txt2img and img2img tabs. The original textbox remains the editor, including selection, autocomplete integration and vertical resizing. Negative and ADetailer prompts are outside scope.

## Five-minute starting guide

1. Open **Organize · prompt preview → Templates** below the positive prompt. For a new prompt, choose a starter under **Start from a template**, then **Insert template**. Edit its count and placement tags for your scene. An existing draft keeps replacement collapsed and requires explicit confirmation.
2. Write in Forge's original positive textbox. Section headings are visual labels; they do not validate your tags. Native Tag Autocomplete remains available. Within one template section, Enter continues that section. Use **Assign line** to correct a label. Drag the native lower-right resize handle to change textbox height.
3. To expand a supported draft, open **Add character to this draft**, set its layout/count/placement, then **Preview added character → Add character**. Update shared scene counts, remove `solo` when needed, and configure Forge Couple yourself. Distinct expressions can bleed without regional conditioning or later inpainting.
4. Before reloading, keep a plain-text copy of the prompt using your usual workflow. Empty section labels, review choices and Undo are page-local. Optional **Save / load draft** is available, but a reported incomplete-save issue remains unresolved; it is not a required step.
5. For an imported messy prompt, use **Organize & review**: choose its scope, confirm ownership, then **Preview organization**. Inspect proposed destinations and duplicate removals; use **Keep** for intentional repeats, preview again, then **Apply organization**. **Revert organization** restores the prior draft while its exact snapshot remains current. Eligible solo/configured Couple prompts can use **Auto Fix** directly; its **Details** and **Revert Auto Fix** controls appear above the prompt.

Too tangled or ambiguous to organize safely? Continue manually or review an LLM-assisted MDPF conversion. MDPF's main purpose is making prompt structure easier to read and write. Use **Ctrl+F5** after installing an update, after keeping a copy of your prompt.

## Start writing

Write or paste into the normal positive prompt, then enable **MDPF mode** or click **Detect / View**. Supported layouts receive colored section headings. A seven-line template maps by position; a heading is a structural label, not proof that every tag belongs there.

Compact display reserves real blank heading rows above logical lines so wrapped text can keep normal spacing. These rows are part of copied prompts and metadata. Extra authored blank rows stay intact. Enabling mode or Detect / View can add missing heading rows; typing and background observation do not. Turning mode off retains the text. **Undo spacing** restores its exact snapshot while valid. The optional two-row L1 setting is under **Info**.

Click a line and open **Assign line** to choose a section or inspect a scored suggestion and its reasons. Accepting a suggestion changes its label, not tag order. Manual labels take priority. **Detected label** resets one correction; **Reset labels** clears them. Splitting/joining lines or replacing the prompt can invalidate labels. Reload clears page-local labels and choices; optional **Save draft file** is intended to preserve prompt text and labels, but its reported incomplete-save issue remains unresolved.

## Choose a workflow

| Prompt | Workflow |
| --- | --- |
| Solo with exactly one plain `1girl`, `1boy` or `1other` | **Auto Fix**, if placements are eligible |
| Solo needing deliberate choices, including a missing count | Reviewed **Organize**, Solo, confirm ownership |
| Supported configured Basic Forge Couple, 2–8 owners | **Auto Fix** or reviewed Regional |
| Standalone `---` chunks with confirmed ownership/shared position | Reviewed **Regional** |
| Plain multi-character prompt with clear character line ranges | Reviewed **Character blocks** |
| Multi-character import with row-leading BREAK and explicit per-character counts | Reviewed **BREAK import · confirm blocks** |
| Standalone `BREAK` without eligible Couple configuration | Reviewed Solo; BREAK does not identify a character |

Limits are **20,000 source characters and 200 editable items total**. An intact weighted group counts as one item. Eight detailed characters can exceed the item limit. Unsupported syntax or unresolved ownership blocks the complete proposal without a partial write.

## One-click Auto Fix

Click **Auto Fix** above the positive prompt to apply an eligible plan immediately, without a review checkbox. Each editable owner needs exactly one plain single-character count. This is an eligibility cue, not a guarantee about generation.

Strong evidence and explicit line labels determine placement. Unknown strings, possible triggers and standalone LoRAs may use provisional L7. Unresolved ambiguity, weak hints, mixed groups, invalid labels or unsupported syntax block the whole edit. `Action` is intentionally ambiguous L2/L7 and needs a deliberate destination. A LoRA placed outside L7 needs a verified bundle through Organize.

The result row appears below the toolbar and above the prompt. It reports organized items, duplicates removed and unknowns provisionally placed in L7. **Details** shows the destination audit and removed tags. LoRA references and recognized style hints are not counted as unknowns. **Open review** opens Organize after a blocked attempt without confirming choices or applying changes.

**Revert Auto Fix** restores exact original text and labels while its snapshot remains current. An already-organized no-op retains the previous valid Revert. Edits, formatting or another extension replacing text can invalidate it; the receipt then becomes historical. To keep a removed repeat, revert and use Organize's Keep controls.

Auto Fix never runs while typing or during text composition. Pending per-item destinations, bundles, ranges and Keep choices are not silently adopted: use reviewed Preview → Apply for those choices.

## Preview and correct a prompt

1. Open **Organize · prompt preview**, choose scope and confirm ownership.
2. Click **Preview organization**. Compare the exact original and proposal; Preview does not write the prompt.
3. Review **Needs attention**. Unknowns may be provisional L7; weak/mixed/ambiguous entries need a destination. Use **All items** to correct recognized tags too.
4. Verify needed bundles and inspect **Duplicate tags · review removals**.
5. Preview again after changing choices, inspect the complete proposal, then **Apply organization**.

For several corrections, expand **Select items · destinations and verified bundles**, tick items or **Select shown items**, choose **Move selected items to**, then **Set destination**. The count includes hidden selections. **Clear selection** changes no destinations. **Automatic destinations** clears selected pending overrides. Set destination invalidates Apply until fresh Preview; selecting alone does not.

Individual destination dropdowns are also available. Manual line labels take priority: change/reset them in Assign line first. Bundle members cannot be selected separately until their bundle is removed. Removed repeats must first be kept. Weighted items move intact and are never split.

To bundle a contiguous range, choose its first/last items and destination, verify the range and any LoRA–trigger associations, then confirm. Every intervening item moves together. A singleton LoRA outside L7 also needs verification. MDPF cannot infer trigger relationships from adjacent text or filenames.

Exact plain repeats are removed by default only in the **same destination, owner and BREAK segment**. Use Keep for an intentional occurrence, then Preview again. Weighted groups, references, bundles and locked shared text are protected. Synonyms and different spellings/case are not merged.

**Revert organization** restores exact source and labels while its snapshot is current. Source edits clear pending choices. Fresh Preview clears checkbox selections while retaining valid destinations. Applied choices become session line labels, not saved global tag overrides or classifier training. Reset labels to resume scoring; bundles need reverification on a new proposal.

## Multiple characters

### Forge Couple regions

Reviewed Regional organization needs literal `---` separators on their own rows. Choose **Shared chunk** explicitly: First, Last or None. Confirm every editable chunk describes one character. Two to eight editable chunks are supported. Shared text, separators and owner order stay locked, including shared unresolved terms, repeats, references and spacing.

Couple Auto Fix requires readable live **Basic Region Assignment**, exact separator `---`, Global Effect first/last/none, disabled Tile Mode and no active unsupported Common Prompts constructs. MDPF reads these settings and never enables or configures Couple. Eligible configured regions are chosen even when Organize's scope is Solo. Advanced/Mask assignment and custom/newline separators require deliberate review of a supported text layout.

With Common Prompts set to `{ }`, a prompt without braces can be eligible; `< >` with angle references is blocked. Unreadable/unsupported settings leave the prompt untouched. Auto Fix also preserves shared spacing: use explicit Detect / View if that chunk lacks heading rows, remembering formatting can invalidate an older Revert snapshot.

### Plain character blocks

Choose **Character blocks** and confirm each character's physical line range. Start each range on its explicit single-character count. Ranges must not overlap. This mode organizes **L3–L7 only**; keep shared quality/camera/action text outside them. An L2 action inside a range blocks it rather than moving across ownership. Text outside all ranges stays locked. This mode requires reviewed Apply, not Auto Fix.

### BREAK and expressions

For an imported prompt like `3girls ...` followed by shared quality/reference text and separate `BREAK 1girl ...` blocks:

1. Open **Organize · prompt preview** and choose **BREAK import · confirm blocks**.
2. Click **Detect candidate blocks**. Detection changes no prompt text. Review the full text and suggested Shared/Character role for every block.
3. Confirm **I verified every shared and character block and the BREAK boundaries**.
4. Preview. Correct individual destinations or verify bundles if needed, Preview again, then Apply. Revert restores the exact original while current.

This import accepts uppercase BREAK at the start of a row, either alone or followed by text on that row. BREAK buried in the middle of a row remains unsupported. It keeps every BREAK delimiter's original bytes, spelling and order, with all shared blocks locked. Character formatting can put the following text on a new row; inspect the exact comparison. It does not replace BREAK with Forge Couple separators or change regional settings.

Confirm two to eight character blocks and at most four shared blocks. Each character block must start with exactly one plain single-character count and contain L3–L7 material. Shared quality, framing, gaze and references stay where authored; they are not redistributed. A plain shared aggregate count, if present, must agree with all owners; multiple/mixed aggregate declarations need manual organization. Empty blocks, counts/ownership conflicts, cross-boundary constructs and other unsupported syntax block the whole proposal. Existing length/item limits apply.

Unknown trigger strings remain provisional L7. Bounded known clothing phrases such as pink ribbon, black serafuku, red bowtie, blue sailor collar and red neckerchief now use L4 automatically; other unrecognized clothing can still need item corrections. No LoRA–trigger association is inferred. Duplicate cleanup stays local to each character; shared repeats remain exact. Source/role changes invalidate confirmation and pending choices. After Apply, redetect and reconfirm before another import preview. Auto Fix is unchanged and does not use these confirmed import roles.

Standalone `BREAK` rows are text-chunk boundaries within an owner. Tags and duplicates never move across them. Outside the reviewed import, inline BREAK remains unsupported for organization; BREAK never establishes another character without explicit ownership confirmation. Sparse/mixed layouts may display Unassigned headings. Use Assign line for explicit display labels instead of treating the heading as proof of a classification error.

Separate character, outfit, expression and background lines can be retained per owner. MDPF provides no conditioning isolation: expressions can bleed between characters. Forge Couple or later inpainting may help. A shared/main expression can be a useful generation choice, not an automatic prompt rewrite.

## Section reference

These are the author's writing conventions, matched through reviewed whole tags and bounded patterns. Unknown phrases can still need correction. Case, underscores, weights and wording are preserved.

| Section | Contents and examples |
| --- | --- |
| **L1 · Quality & medium** | Quality/resolution, `newest`, Pony scores; reviewed rendering phrases: cinematic/volumetric/anime lighting, ray tracing, dramatic shadows, anime screencap/coloring. |
| **L2 · Camera, pose & action** | Portrait, cowboy shot, body/subject focus; sitting/crossed legs, brushing hair, holding hat/sword, covering own mouth, hand over eyes, wiping tears and head turns. Focus does not establish counts/ownership. |
| **L3 · Character** | Counts/identity, recognized character names, build/skin, hair/eyes/pupils, makeup, marks, nails and natural claws/ears/horns/tails/wings. White pupils, ahoge, antenna hair, French braid, long arms, cat paws and black nails are examples. |
| **L4 · Outfit** | Clothes/armor, reviewed profession costumes (maid, nurse, knight, nun, prisoner), all worn accessories, coverage/exposure/cutouts, fake features and reviewed carried props. Serafuku, detached sleeves, crop top, breastplate, chainmail, gauntlets, bracers, gold bracelet, bare shoulders, covered face, navel cutout. |
| **L5 · Gaze & expression** | Looking up/back/at another/viewer; angry, worried, surprised, sad, excited, disgust; smile variants, narrowed/wide eyes, one eye closed, tearing up, talking/shouting, clenched teeth, licking lips, tongue out. Head tilt retains this convention. |
| **L6 · Background** | Simple/color backgrounds, scenery, furniture, walls/buildings/structures: on bed, throne, pillar, stone wall, castle, ornate chair, white background. Existing sunlight/moonlight/backlighting and reviewed colored scene effects stay here. |
| **L7 · Style** | Style phrases, standalone LoRA references and provisional unknowns/triggers. A fallback does not prove an unknown term is a style tag. |

`Action` remains L2/L7 ambiguity; `sketch` and anime style retain L1/L7 context. Empty/blank/sparkling/heart-shaped eyes can remain L3/L5 ambiguity. Unknown names/triggers are not classified from a neighboring LoRA. Manual examples may change wording or emphasis; MDPF does not copy those edits into imports.

Reviewed imported phrases also include high resolution/ultra detailed/perfect details (L1), reaching viewer/aiming at viewer (L2), androgynous/tomboy (L3), and bags, school bags, strap between breasts, obi, floral print and detached wings hair ornament (L4). Autumn/autumn leaves use L6. Gun/handgun descriptions follow the final carried-prop group in L4; their holding action stays L2. These are exact or existing bounded forms, not a general prose parser.

Adding a missing count does not bypass another review requirement. `Day`, `night`, `sun`, `moon`, `sunlight`, `moonlight`, `water` and `daylight` now have firm L6 destinations, as do reviewed time/weather/scenery/season tags and `aura`, `sparks`, `embers`. They no longer require tentative acceptance. A LoRA's trigger string stays provisional L7 unless deliberately placed or included in a verified bundle. Bare flower/leaf terms and energy wings are not automatically interpreted as worn adornments, scenery or character anatomy from neighboring tags.

### Important distinctions

| Phrase type | Destination |
| --- | --- |
| Reviewed `covered eyes`, `covered mouth` and other covered body parts | L4 coverage |
| `Covering own eyes`, `eyes covered by hands` | L2 physical action |
| `Closed eyes`, `rolling eyes`, `one eye closed` | L5 facial state/action |
| `Hair over eyes`, `eyes covered by hair`, eye color/pupils | L3 appearance |
| Natural claws/tail/animal ears/horns | L3 |
| Fake claws/tail/ears/horns, claw gloves | L4 costume |
| Claw/paw/rabbit pose | L2 |
| Broad shoulders, cleavage, navel | L3 body traits |
| Bare shoulders, cleavage cutout, navel cutout | L4 garment/exposure |

Only reviewed bounded phrases match: `covered wagon` does not become clothing. Complete garments such as `sword print shirt`, `hat print shirt` and `white background print dress` remain garments. Unreviewed phrases such as `over shoulder` or `shushing` can still use provisional L7.

## Order within sections

Only **Auto Fix** or **Organize → Apply** writes order. Typing/detection only display labels. Equal-ranked tags retain source order. Contradictory tags are preserved; no missing tags are invented.

- **L1:** standalone `score_1`–`score_9`, optionally `_up`, lead by descending numeric score. `_up` does not affect priority. Spelling/equal-score order remain intact. Explicit destinations elsewhere, weighted groups and verified bundles retain priority.
- **L3:** existing count then existing solo; identity/type; hair; eyes then pupils; face/makeup/located marks; build/general skin; neck/shoulders/chest/back/abdomen; arms/hands/nails; hips/buttocks/thighs/legs/feet; natural appendages. Generic marks use general skin rather than a guessed location.
- **L4:** general states (nude/naked/wet/torn clothes); unlocated details; head/hair adornments; face/ears; neck/shoulders; torso/complete garments; arms/wrists/hands; waist/abdomen; hips/thighs/legs/ankles; footwear; reviewed weapons/carried accessories last. Equal-area shirts/jackets retain order without inferred layering.
- **L5:** recognized gaze/look directions first, keeping multiple gazes in source order; remaining expressions keep source order too. Conflicting directions/emotions are not deleted.

L3/L4/L5 sorting stays inside automatic plain runs. Explicit line/item choices, bundles, weighted/opaque groups and unranked appearance descriptors are barriers. A protected item can precede a count or outfit state. Sorting never crosses owners, locked shared text or BREAK. Complete garments are not split across body areas.

## Pair actions with object descriptions

| L2 interaction | Object description |
| --- | --- |
| `Sitting on throne` | `Ornate throne` in L6 |
| `Holding chair` | `Wooden chair` in L6, even though held |
| `Holding sword` | `Silver longsword` at the end of L4 after footwear |
| `Holding umbrella` | `Red umbrella` at the end of L4 |

Reviewed bare weapon/umbrella types also default to L4 without inferring they are held. Explicit scene forms such as beach/patio/garden umbrella, umbrella stand and weapon rack use L6. Use item/line choices for another intended scene interpretation. MDPF adds no missing descriptions and does not bind attributes to the held object.

## Save, undo and troubleshoot

Save/copy the **actual prompt**, including intended separator and blank rows, when sharing generation text. Use **Save / load draft** for explicit local persistence of source and line labels. Labels are not embedded as generation tags or global preferences. Pending bundles, organization choices and Undo history remain page-local. Forge may restore plain text after reload; reopening an MDPF draft file also restores its saved editor labels.

Revert is an exact snapshot guard, not permanent undo history. Later edits, spacing changes or another extension replacing text can invalidate it. Save a source copy when experimenting. Reordering may change generation results even if all tags are retained.

After an update use **Ctrl+F5** for stale display. If autocomplete is missing, compare the same input with mode off and check Tag Autocomplete's own settings; MDPF uses the native textbox. See [Troubleshooting](troubleshooting.md) and [Known limitations](known-limitations.md). MDPF changes no negative/ADetailer prompt, model or generation setting.

Known outfit qualifiers use a reviewed vocabulary of 48 clothing/accessory nouns and up to four color/material/garment modifiers. Examples include light blue sailor collar, silk ribbon and plaid serafuku. Holding/pulling/adjusting/putting on/taking off/removing/lifting these supported objects uses L2. Whole phrases stay intact; arbitrary trigger strings or adjective combinations are not inferred. Bare ribbon/bow remains an unlocated L4 detail; explicit hair ribbon/bow uses the head group.

## Blank starters

Open **Organize · prompt preview** below the positive prompt, then select the **Templates** tab. The neighboring **Organize & review** tab holds the existing preview and organization controls. Switching tabs preserves choices and never edits the prompt. An empty prompt opens **Start from a template**. With an existing draft, **Add character to this draft** and **Save / load draft** open by default; **Replace draft with a template** stays collapsed. Expand replacement when you want a fresh starter. Your expansion choices persist while the draft context stays the same, and focused controls are never collapsed. Blank labeled slots also count as a draft. Short guidance explains unavailable actions; disabled buttons also carry an accessible explanation. Choose **Solo**, **Two characters · placement line**, or **Forge Couple · multi-character**. The outline previews section labels and the few starter tags that will be inserted. Nothing changes until **Insert template**. If a draft exists, explicitly check **Replace the current draft** first. **Undo template** restores the exact previous source while the inserted result is still current; subsequent edits disable that undo.

Solo starts with `1girl, solo,`. The ordinary two-character starter uses shared L1/L2, C1 L3/L4/L5, `man next to girl,` as a placement line, C2 L3/L4/L5, then shared L6/L7. Its default counts are `1girl` and `1boy`; edit counts and placement for your scene. The second expression row is optional: leave it empty when sharing the main expression. Distinct expressions can bleed; regional conditioning or later inpainting may help.

Forge Couple supports **2–8 characters**, with Shared region **First / Last / None**. Every character starts with editable `1girl,` and blank L4/L5/L6 rows. Shared First/Last adds blank L1/L2/L6/L7 sections. Literal `---` rows divide regions. Match the separator and Global Effect position in Forge Couple yourself. Insertion never enables, configures or resizes Forge Couple regions.

Empty sections have visual labels and real blank rows, without placeholder quality/appearance/LoRA tags. Type directly in the original textarea; autocomplete, selection and resizing continue there. Blank labels and starter ownership metadata survive normal same-line typing and Detect in this page. They are page-local unless explicitly exported and reopened using Save / load draft: reloading, external replacement, edits across sections or Reset labels can remove them. Within a known template section, Enter and multiline paste continue that section and character, with one heading; joining its own continuation rows preserves the label. Empty content rows remain editable slots. Pasted control markers and edits across headings/owners do not inherit a section. Source text remains intact; use Detect/Assign line for a completed prompt. Turning MDPF off hides decorations, not source rows.

## Add a character without replacing the draft

Under **Organize · prompt preview → Templates → Add character to this draft**, choose Ordinary or Forge Couple, the new count tag (`1girl`, `1boy`, `1other`), and either an editable placement line or the existing shared-region position. **Preview added character** shows the exact complete proposed prompt without writing. **Add character** applies that proposal. Changing source, labels, options or Couple settings requires a new preview.

Ordinary insertion needs labeled L3 count lines. It inserts a placement line and blank L3/L4/L5 before the trailing shared L6/L7 sections, or appends when no shared tail exists. Couple insertion needs standalone `---` boundaries, exactly one explicit single-character count per existing owner region, and the correct Shared First/Last/None position. It adds L3/L4/L5/L6 while preserving the shared chunk position. When Couple is enabled, its Basic mode, separator and shared position must match; the extension never changes those settings.

Existing source text, LoRAs, continued sections and manual labels are retained. No existing `solo` or aggregate count tag is silently removed or updated: fix those for the new scene yourself, and configure the new Forge Couple region manually. **Undo added character** restores the exact previous draft while the inserted result remains current; later text edits disable that undo. The workflow supports up to eight characters. Raw/unclear ownership, mixed separators, competing owner counts, BREAK/advanced controls and composition in progress require manual completion or another supported layout.

## Save and reopen a draft

**Known issue:** draft saving has been reported to omit part of an existing prompt and is not confirmed fixed. This optional feature is not required for normal use. Keep a plain-text copy using your usual workflow; it preserves prompt text, not empty labels or page-local Undo.

Open **Organize · prompt preview → Templates → Save / load draft**. **Save draft file** downloads `mdpf-draft.json` with the current positive prompt, section/character labels, empty slots, continued sections and editor display preferences. There is no automatic recovery or browser storage. Verify any optional saved file against your plain-text copy. Rename or move downloaded files yourself as desired.

Choose an **MDPF draft file** to read and preview it locally. The preview shows the exact incoming prompt and a line/label summary; choosing a file does not change the current draft. Check **Replace the current prompt and labels with this draft** when a draft already exists, then select **Load draft**. If your current prompt, labels or editor state change, select **Preview draft** again. Invalid/unsupported files leave the current draft untouched. **Undo loaded draft** restores the exact previous source, labels and display preferences until another text/label/editor edit changes the loaded result.

Save/load works independently in txt2img and img2img and supports moving a draft between them. It does not save models, seeds, generation settings, classifier changes, pending organization choices or Undo history. Forge Couple guidance is only a separator/shared-position reminder; loading never enables or configures Couple. Generation metadata remains plain prompt text; the JSON labels are never inserted into it.

Version 1 files use LF newlines and allow up to 100,000 prompt characters, 10,000 source rows and 2 MB of JSON. Files are validated before Load is enabled. Unsupported schema versions require a compatible extension version rather than silently losing labels.

## Reverting organization while drafting

**Revert organization** and **Revert Auto Fix** restore the original prompt together with its blank-slot labels, character assignments, continued sections and editor display state. The restore remains guarded by the exact current output text. This is a page-local snapshot; draft files do not include Undo history. A later source edit can invalidate Revert.

The end-to-end batch covers saving/reopening, continuing an outfit section, adding a character, organizing and saving again across 60 authored prompt/layout combinations. Ordinary multi-character organization still requires confirmed nonempty character ranges; Forge Couple shared chunks must contain authored context before organization. Unverified character LoRAs and dynamic constructs retain their existing review/unsupported guards.
