# Working on the fork

## Branches

| Branch | Tracks | Holds |
| --- | --- | --- |
| `master` | `upstream/master` | Upstream code only. Never commit here. |
| `personal` | itself | Upstream plus every fork change. This is what gets built and installed. |
| `fix/*`, `feat/*` | `master` | One change each, cut from `master`, so it can go upstream as a pull request. |

Remotes are `upstream` (TheKonka) and `origin` (shbernal).

## Fork-only changes

These stay on `personal` and never go upstream:

- `src/manifest.firefox.json`: name, `homepage_url`, the gecko ID `instagram-download@shbernal`, `data_collection_permissions` and the Android minimum version (142.0, the first Firefox for Android that supports `data_collection_permissions`).
- `scripts/zen-release.sh` and the `web-ext-artifacts` line in `.gitignore`.
- `README.md`, `AGENTS.md` and `docs/`.
- The four-part version in `package.json` (see [release.md](release.md)).

## Making a change

1. Branch from `master` if the change could go upstream, from `personal` if it can't.
2. Build with `pnpm build:ff` and test in the browser. There are no automated tests.
3. Run `pnpm lint`.
4. Merge the branch into `personal`.
5. For an upstream candidate, push the branch to `origin` and open a pull request against `TheKonka/instagram-download-browser-extension`.

## Syncing with upstream

```bash
git fetch upstream
```

```bash
git switch master && git merge --ff-only upstream/master && git push origin master
```

```bash
git switch personal && git merge master
```

Conflicts usually land in `src/manifest.firefox.json`, `README.md` and the `version` in `package.json`. Keep the fork's manifest fields and README. For `version`, take upstream's number. The next release appends `.1` to it.

Once upstream merges one of the fork's pull requests, the merge brings the same change in again. Git resolves it cleanly when the code matches.
