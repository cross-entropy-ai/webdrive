# Publishing a release

The release workflow follows the `git-review` packaging flow: a stable tag builds
four platforms, generates a Homebrew formula and SHA-256 checksums, uploads a
draft release, and publishes the assets together.

## Release

From a clean checkout after CI passes:

```sh
make test
git push origin main
git tag -a v0.1.4 -m 'Release v0.1.4' # Use the next available version.
git push origin v0.1.4
```

Only `vMAJOR.MINOR.PATCH` tags are accepted. Go follows `go.mod`; Bun and workflow
actions are pinned in CI and the release workflow. Builds disable CGO and embed
the production frontend.

Each release includes:

- `webdrive_{darwin,linux}_{amd64,arm64}.tar.gz`, containing `webdrive`, `README.md`, and `LICENSE`.
- `webdrive-{darwin,linux}-{amd64,arm64}`, preserving the raw binary URLs used by the existing installer.
- `webdrive.rb`, with tagged archive URLs and checksums for all four platforms.
- `checksums.txt` and `install.sh`.

## Automatic Homebrew updates

The `Sync webdrive` workflow in
[`cross-entropy-ai/homebrew-tap`](https://github.com/cross-entropy-ai/homebrew-tap/actions/workflows/sync-webdrive.yml)
checks the latest stable release twice an hour. GitHub may delay scheduled runs.
It verifies the formula against the published checksum manifest, refuses version
rollbacks, and commits `Formula/webdrive.rb` only when it changes. It uses the
tap's own `GITHUB_TOKEN`; no cross-repository secret is required.

For an immediate update after publishing, trigger the tap workflow:

```sh
gh workflow run sync-webdrive.yml --repo cross-entropy-ai/homebrew-tap
```

Once that workflow succeeds, users can run:

```sh
brew install cross-entropy-ai/tap/webdrive
# For existing installations:
brew update && brew upgrade webdrive
```

## Verify packaging locally

```sh
(cd ui/ui && bun install --frozen-lockfile && bun run build)
python3 scripts/release.py v0.1.4
(cd dist/v0.1.4 && sha256sum --check checksums.txt)
```

Use `shasum -a 256 --check checksums.txt` on macOS. Outputs live in ignored `dist/`.
`make test` includes offline tests for archive contents, executable permissions,
checksums, formula URLs, reproducibility, and invalid release tags.

## Recovery

Rerun failed jobs after correcting configuration or transient failures. The
workflow can also be dispatched for an existing tag:

```sh
gh workflow run release.yml --ref v0.1.4
```

Published assets are not overwritten on retries: the workflow compares their
checksum manifest with the rebuilt manifest. Do not move published tags; publish
a new version for code changes. A tap sync failure does not affect the GitHub
Release; rerun the tap workflow after fixing the cause.
