# Forge private-alpha baseline acceptance

Baseline: 0.48.3-alpha.1, 2026-10-23. MIT selected by the owner. Page discovery now resumes after browser history-cache restoration. Classification and organization rules remain unchanged. The owner confirmed physical resizing works. Draft saving was reported to omit an existing full prompt and was explicitly deprioritized; it is a known issue, not a prerequisite for the visual/writing baseline. The clean source has been published to the owner's private GitHub repository, with passing Windows/Linux CI.

Automated evidence: 3762 workspace JavaScript tests, fourteen packaging checks and two clean-handoff checks pass. The clean repository has its own neutral subset; it does not contain the private evaluation fixtures. See CONTRIBUTING.md for the developer workflow. These are authored regressions, not an independent accuracy or image-quality benchmark.

## Optional draft reproduction — no user retest required

Browser download and file-selection permission was denied in the previous live pass. That refusal remains in effect; no alternate transfer route is used. The following remains a developer reproduction checklist for the optional persistence issue, not work the owner needs to repeat:

1. Start a Solo or pair template and type into at least two labeled sections. Continue a section with Enter so it has two content rows. Save through **Templates → Save / load draft → Save draft file**.
2. Reload the page. Page-local Undo history is expected to be gone. Type a small temporary prompt before loading, so the next Undo has a clear target.
3. Choose the saved JSON file. Confirm that preview alone does not replace the current prompt. Confirm replacement, then **Load draft**.
4. Verify exact prompt text, empty section headings, continued-section grouping and character labels. Check that generation/Couple settings were not changed.
5. Use **Undo loaded draft** immediately. It should restore the temporary prompt from step 2; it does not restore Undo history from before the reload.

Physical resizing is accepted based on the owner's direct report that it works well. Browser automation had not exercised dragging. Harness checks cover 360/560-pixel prompt columns, not every full-window/mobile layout.

Do not claim draft persistence is fixed or independently verified. Offline serialization/controller checks retain the whole synthetic prompt, which does not explain or dismiss the owner's reported live problem. Several normal work sessions are still needed before claiming routine-use reliability; draft saving is not a publication gate.

## Sharing boundary

The clean source handoff contains the fourteen runtime modules, stylesheet, MIT notice, user/developer guides, packaging tools and neutral self-contained tests. Private PNG metadata, source images, bulk external vocabulary/alias catalogs, personal prompts, outputs, backups and private history are excluded by allowlist. Do not upload the whole private development workspace in place of the clean candidate.

MIT covers the project's original code; it does not establish redistribution rights for separately sourced datasets. The license text was checked against the [Open Source Initiative MIT license](https://opensource.org/license/mit). The bulk autocomplete dataset has not been added to this release. Future third-party additions need their own provenance and notices.

The current maintenance scope is Forge Neo visual structure and writing. Persistence remains optional. ComfyUI is outside this project and would be separate if pursued.
