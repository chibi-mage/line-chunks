# Install Line Chunks

## First installation

1. In Forge, open **Extensions → Install from URL**.
2. Paste `https://github.com/chibi-mage/line-chunks` into **URL for extension's git repository**.
3. Leave **Specific branch name** and **Local directory name** blank. Click **Install**.
4. When installation finishes, open **Installed** and click **Apply and restart UI**. Keep a copy of any open prompt before restarting.
5. Refresh the page when Forge is ready. Look for **Line Chunks** and **Detect / View** above the positive prompt.

No extra installation steps or packages are needed. Forge creates the `extensions/line-chunks` folder and manages the Git checkout.

## Updating

Use Forge's **Extensions → Installed** page to check for updates, apply the update for Line Chunks, and restart the UI. Keep a copy of your open prompt before restarting or refreshing.

If you previously installed a manual ZIP copy, close Forge and move that older copy outside `extensions` before installing through the URL. Keep the backup until the new copy works. Install only one copy of Line Chunks. Existing draft files continue to load.

## Disable or remove

Disable Line Chunks on Forge's **Installed** page and apply the change. To remove it, close Forge and move its `extensions/line-chunks` folder outside `extensions`.

Removing the extension does not restore prompt text you explicitly organized. Use a current Revert/Undo snapshot or your own saved prompt when you want the earlier text.

## Optional packaged downloads

[GitHub Releases](https://github.com/chibi-mage/line-chunks/releases) also keeps versioned ZIP downloads with checksums. Those packages retain their original archive layout and installation notes. The normal installation above uses Forge's URL installer.

## Technical compatibility

The current host checks are recorded in the repository's host-compatibility document. Other builds and themes may need testing; see [Troubleshooting](troubleshooting.md) and [Known limitations](known-limitations.md).

The text format, saved draft schema and internal module identifiers remain compatible with earlier versions. The original MIT notice is retained.
