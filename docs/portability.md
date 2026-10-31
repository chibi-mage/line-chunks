# Portable core and host adapter boundaries

Current scope is Forge Neo. Keep the text engine independent of the Forge UI for testing and maintenance. ComfyUI is not on this project's roadmap; any eventual port would be a separate project. The adapter notes below are architectural reference only, not planned implementation work.

| Layer | Modules | Responsibility |
| --- | --- | --- |
| Portable source/structure | mdpf-core, mdpf-controls, mdpf-structure, mdpf-assignments | Source spans, control boundaries, line metadata. |
| Portable evidence | mdpf-classifier, mdpf-rules, mdpf-curated, mdpf-review | Lookup normalization, scores and review projections. |
| Portable planning | mdpf-organize, mdpf-line-organization | Scoped moves, choices/bundles, duplicate auditing, explicit label projection/rebase, solo Auto Fix eligibility. |
| Forge view | mdpf-inline, mdpf-organize-view | Native textarea decorations, events, review controls, guarded Apply/Revert. |
| Forge entry | mdpf-forge | Discover positive textboxes, mount/dispose controllers and observe host changes. |
| Forge presentation | style.css | Host-specific layout and colors. |

Module names above have prefix `javascript/` and suffix `.mjs`. Portable modules should remain free of DOM, disk and network dependencies. Development Node tools/fixtures are not runtime dependencies.

A ComfyUI port first needs to define which text widget/node owns the source, and how graph load, undo, node deletion or widget replacement invalidate snapshots. Supply a bridge for reads, exact guarded writes, source-change events and metadata persistence. Preserve explicit ownership and scope constraints.

Reuse source preservation, syntax, evidence, duplicate and organization fixtures. Add graph serialization, lifecycle, undo and widget tests. Replace Forge selectors, Gradio events, CSS and module loading.

Forge inline LoRA references are text to the engine, not a promise to load LoRAs in ComfyUI. Likewise `---`, BREAK and character labels do not configure graph conditioning or regional masks. Host conditioning semantics need separate implementation and validation.

Character anatomy ordering lives in the portable planner, using reviewed ranks in mdpf-rules plus bounded whole appearance forms. It runs only on already-classified automatic L3 items. Preserve equal-category order, manual/opaque/unranked barriers and ownership scopes in future adapters. The 576 authored shuffled prompt variants and exact Revert checks can be reused independently of Forge.

L4 ordering reuses the portable scoped run sorter with its own reviewed exact, suffix and location tables. Classification must assign automatic L4 before this ordering metadata is consulted. Preserve leading states, stable area ties, full-tag action/garment distinctions and unranked/manual/opaque/bundle boundaries. The outfit-order tests are host-independent except the existing controller stub for guarded Revert.

The frozen combined appearance corpus and pre-fix baseline exercise L3/L4 together. The exact review patch remains data in the existing rules module. Reuse both successful scoped cases and 200-item/ambiguous-owner rejection tests when porting; do not silently remove those guards.

Selected-item controls belong to the host review view and reuse the existing placements-by-source-index planner API. No portable scoring/ordering changes are required. Future adapters must invalidate controls when source/labels/preview generation changes and retain existing scope, manual-label, bundle, IME and guarded write/undo protections.

L5 uses the same portable scoped stable sorter as L3/L4, with a two-group gaze-first rank rather than anatomical ranks. Focus/framing and expression mappings remain in the rules module; no host dependency or new runtime file is added. Preserve stable gaze/non-gaze order and all existing barriers when porting.

The action/expression audit reuses the portable classifiers/planners without new host logic. Preserve the frozen raw/reviewed baselines, explicit expected-order annotations, exact collision overrides and L3–L7-only plain character range guard in a port.

Scene/prop policy uses the existing portable classifier and final L4 rank 100, after footwear rank 90. Exact nominal roles and three anchored modifier/action patterns are embedded in mdpf-rules. They do not link object attributes, infer ownership or synthesize missing descriptions. Future adapters should reuse the paired action/object tests and retain manual/weight/bundle/scope barriers.

Reviewed BREAK import uses portable source spans and explicit per-block roles in mdpf-organize. The Forge view only detects, presents roles and gathers confirmation. Reuse the detector/planner in a future host; preserve exact delimiter/shared gaps, count validation, L3–L7-only character scope and stale-confirmation guards. No Forge conditioning or new runtime dependency is introduced.

Qualified outfit decisions use two bounded portable patterns and noun-to-body-area metadata in mdpf-rules. Preserve full-phrase L2 action precedence, the unlocated ribbon/bow group and manual/weighted/owner barriers; no host-specific code or new runtime module is needed.

Blank starters are built in portable mdpf-assignments as source plus row-slot metadata. The Forge adapter owns preview, explicit replacement, native events, display and guarded undo. A ComfyUI port must define graph persistence for empty-slot labels; do not serialize visual labels as prompt tags.

Template continuation tracking accepts an optional validated source/selection edit range from the host beforeinput event. New adapters must supply their own trustworthy edit context, preserve section group IDs, and never infer continuity across headings, controls or owner boundaries. Without a reliable range, repeated blank rows may remain ambiguous.

planCharacterAddition/applyCharacterAddition in mdpf-assignments implement insertion-only source planning and metadata rebasing without DOM dependencies. The host owns exact preview, source/options/config guards, composition handling and undo snapshots. Preserve shared chunks and old source bytes; do not infer conditioning configuration or rewrite aggregate counts.

## Portable draft format v1

`mdpf-drafts` is a DOM/filesystem/network-free schema validator and serializer. Envelope: `format: "mdpf-draft"`, `schemaVersion: 1`, `prompt` (exact LF text), `editor`, `lines` (one entry per physical source row including trailing blanks), and `coupleHint` (null or separator/sharedPosition guidance). No generation configuration or automatic file paths are included.

`editor` has boolean enabled/compact/extraQualityLine fields. Each line has module (null or 1–7), kind, manual/header flags, template/templateHeader/continuation flags, group (null or a nonnegative file-local integer), character (null or a positive number), characterId and regionId. Spans and runtime IDs are recomputed from source; control protection is derived from source and refreshed against the current host. Continuation groups must be contiguous and agree on section/character. Export normalizes broken groups caused by manual edits without rewriting prompt text.

`serializeDraft`, `parseDraft`, `validateDraft`, `restoreDraft` enforce supported fields/version, types, source-row correspondence, control/header constraints, 100,000 UTF-16 source units, 10,000 rows and a 2 MiB file bound. A future ComfyUI adapter can reuse this source/metadata contract but must implement its own file picker, download, widget display preferences and exact guarded undo; Couple hints never configure graph conditioning.

The organization adapter accepts optional getEditorSnapshot/restoreEditorSnapshot callbacks for page-local Revert. Capture full label/header/group/display state independently of portable placement constraints; after exact source restoration, validate physical spans and restore metadata without inserting formatting rows. Hosts without this bridge retain the previous line-label fallback. Undo snapshots are never included in exported draft files.

## Line Chunks branding

The 0.50.0 rebrand retains internal mdpf module/DOM/CSS identifiers, `mdpf-editor` installation/manifest identity, and `mdpf-draft` v1 serialization. These are compatibility identifiers, not missed UI labels. The visible product is Line Chunks Editor; no classification, ordering or scope change accompanies the rename.
