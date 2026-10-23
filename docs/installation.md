# Installation and removal

This private alpha targets Forge Neo with support for extension `.mjs` modules and root `style.css`. No pip, npm, Python extension script or Forge core changes are required.

## First installation

1. Keep a plain-text copy of your prompt using your usual workflow, then close Forge.
2. Extract `mdpf-editor-0.48.5-alpha.1-forge-private-alpha.zip` into Forge's `extensions` directory. The result must be `extensions/mdpf-editor/javascript/mdpf-forge.mjs` and `extensions/mdpf-editor/style.css`, with no second nested `mdpf-editor` directory.
3. Start Forge with your usual launcher. Keep a copy of your prompt before Ctrl+F5 to refresh the browser.
4. Look for **MDPF mode** and **Detect / View** above the txt2img/img2img positive prompts, and **Organize · prompt preview** below them.

The archive includes README, five guides, three documentation screenshots, the MIT `LICENSE` and `release-manifest.json`. They are not executed by Forge.

## Update

Keep a plain-text copy of your prompt and close Forge. Move the old extension folder to a backup location outside `extensions`, then extract the new package. Keep the backup until the new version is checked. Start Forge and hard-refresh. Replacing the entire folder avoids mixing versions. Optional Save / load draft preserves prompt text and manual labels and is confirmed working by the owner. Pending review choices and undo history remain page-local.

## Disable, remove or roll back

Disable MDPF in Forge's Extensions interface and restart Forge, or close Forge and move its folder outside `extensions`. Refresh the browser afterward. To roll back, restore the saved folder while Forge is closed, then restart and hard-refresh.

Removal does not undo text you explicitly formatted or organized. Save the original prompt, use Undo spacing/Revert while their snapshots are current, or restore your own draft before removing the extension.

## Integrity and validation

The manifest records SHA-256 digests for every other packaged file. It detects accidental mismatches; it is not a signed publisher identity. The packaging tool checks the archive, module imports, documentation links and an isolated extraction/removal cycle. That filesystem check does not substitute for launching an independent Forge installation.
