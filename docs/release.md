# Releasing to Zen

`scripts/zen-release.sh` turns `personal` into a signed `.xpi` and opens it in Zen.

```bash
scripts/zen-release.sh
```

## What it does

1. Refuses to run unless the current branch is `personal` and the tree is clean.
2. Bumps the version in `package.json`.
3. Runs `pnpm install --frozen-lockfile` and `pnpm build:ff`.
4. Signs `dist/firefox` with `web-ext sign --channel unlisted`. AMO signs unlisted add-ons without review, usually in a minute or two, and does not list them.
5. Commits the bump as `chore: fork release <version>`. If signing fails, the bump stays uncommitted. Discard it with `git checkout package.json`.
6. Opens the `.xpi` from `web-ext-artifacts/` in Zen, which asks once to confirm the install.

## Requirements

- AMO API credentials in [fnox](https://github.com/jdx/fnox) as `MOZILLA_ADDON_JWT_ISSUER` and `MOZILLA_ADDON_JWT_SECRET`. Get them from <https://addons.mozilla.org/developers/addon/api/key/>.
- `zen-browser` on `PATH`, with the profile under `~/.config/zen`.

## Versions

AMO rejects a version it has already signed for the same add-on ID. The fork appends a fourth number to upstream's version and increments it per release:

```
2.5.0 -> 2.5.0.1 -> 2.5.0.2
```

After merging an upstream release such as 2.6.0, the next release is 2.6.0.1.

## Replacing the upstream add-on

The fork has its own ID, so Zen treats it as a separate add-on. If the upstream AMO add-on (`1094918@gmail.com`) is still installed, the script prints a warning. Remove the upstream one in `about:addons`, or both will add buttons to every post.
