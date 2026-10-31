# Automated Forge checks and downloadable builds

The **Forge CI** workflow runs for pushes to main, pull requests and manual runs from the Actions page. It tests the clean repository's self-contained regressions, not the private workspace's additional fixtures.

Three checks cover Ubuntu 24.04 with Node 18/Python 3.9 (the documented minimums), ubuntu-latest with Node 24/Python 3.13, and Windows with Node 24/Python 3.13. Each runs `npm test` and the packaging tests, including fixed cross-platform ZIP metadata. No dependency installation is needed for the project tests. The official setup actions provide the requested runtimes.

**Build tested Forge ZIP** waits for all three checks to pass. It invokes the existing allowlisted packager and uploads only the installable ZIP and its `.zip.sha256` file. Test-only fixtures, workflows, Git history, outputs and private source material are not added to the Forge package. Artifacts are kept for fourteen days.

## Download the public alpha

Use the named Forge ZIP and checksum under the [0.50.0-alpha.1 release](https://github.com/chibi-mage/line-chunks-editor/releases/tag/v0.50.0-alpha.1) for the published alpha. Release downloads are separate from the short-lived development artifacts below.

## Download a development build

1. Open the repository's **Actions → Forge CI** page.
2. Select a successful run for the commit you want. Confirm **Build tested Forge ZIP** succeeded; an incomplete or failed run has no tested package from that job.
3. Under **Artifacts**, download the item named `line-chunks-forge-<commit>-<attempt>`. GitHub may require a signed-in account for artifact downloads.
4. Extract that artifact download. It contains the actual `line-chunks-editor-<version>-forge-alpha.zip` and its SHA-256 sidecar. Install the inner Forge ZIP according to the installation guide.

Artifacts are per-commit test builds, not GitHub Releases. A green run does not prove image quality, every host integration or every browser file-transfer route. Draft saving is separately confirmed by the owner's live testing. Expired artifacts can be rebuilt with a manual workflow run.

## Failure and maintenance behavior

A failed check prevents the package job from running. Check the failed step's log before changing code or rerunning; the matrix continues its other checks to expose platform differences. Newer runs cancel obsolete runs for the same main branch or pull request. Action implementations are pinned to full verified commit SHAs; update them deliberately with their version comments.

The workflow requests only repository contents read access, does not persist checkout credentials and publishes no release, tag, repository commit or external deployment. Branch protection and required-check policy are separate repository settings and are not configured by this workflow.

References: [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [setup-python](https://github.com/actions/setup-python), and [upload-artifact](https://github.com/actions/upload-artifact).

The minimum-version job pins Ubuntu 24.04 because Python 3.9 is not supplied for the Ubuntu 26.04 runner. The current-version Linux job still follows ubuntu-latest. A setup failure before tests is infrastructure evidence, not an extension regression.
