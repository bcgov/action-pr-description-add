# Add to Pull Request Descriptions (Moved)

> [!IMPORTANT]
> **This action has moved to [`bcgov/actions/pr-description-add`](https://github.com/bcgov/actions/tree/main/pr-description-add).** This repository is retiring and will be archived. Update workflows to the new path, pinned to a [release](https://github.com/bcgov/actions/releases) (not `@main`):
>
> ```yaml
> - uses: bcgov/actions/pr-description-add@8843560d44aa717798dacb6831bf87161d0658ca # v0.11.0
>   with:
>     add_markdown: |
>       Thanks for the PR!
> ```
>
> | Old input | New input |
> | --- | --- |
> | `github_token` | `token` |
>
> `add_markdown` keeps its name.

## Releases (maintainers)

`dist/` is git-ignored and never on `main`. Publish from the [Releases page](../../releases/new); automation does the rest. **Do not push release tags by hand** (neither `vX.Y.Z` nor `vX.Y.Z-src`).

1. On the Releases page, create tag `vX.Y.Z` targeting `main` (the tip) and publish.
2. The [release workflow](./.github/workflows/release.yml) tags that commit `vX.Y.Z-src` (kept permanently), builds `dist/` on a side commit, moves `vX.Y.Z` and the major tag (`vX`) onto it, and regenerates the notes from the previous `-src`. For a minute or two `vX.Y.Z` has no `dist/`; wait for the run to go green before pinning.

Pin `vX.Y.Z` (or its SHA), never a `-src` tag. Releases made by `github-actions[bot]`, or already pointing at a dist commit, are skipped.

- **Tag protection is procedural.** No tag ruleset is expected on this repo.
- **Failed run or no-dist tag:** a release without `dist/index.js` (or an orphan `vX.Y.Z-src`) is not reused. Delete the broken release and its tag, fix the cause, and publish the next patch version.
