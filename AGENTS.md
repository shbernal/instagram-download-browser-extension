# AI project guidelines

Personal fork of [TheKonka/instagram-download-browser-extension](https://github.com/TheKonka/instagram-download-browser-extension), a Chrome and Firefox extension that downloads Instagram and Threads media. Used daily in Zen.

- Key commands
  - `pnpm build:ff`, `pnpm build:chrome` (type-check, then build into `dist/<platform>`)
  - `pnpm dev:ff`, `pnpm dev:chrome` (watch)
  - `pnpm lint`
  - `scripts/zen-release.sh` (bump, sign, commit, install; only when asked)
  - No automated tests. Verify in the browser and say what wasn't verified.

- Key documentation
  - [docs/fork.md](docs/fork.md): branches, fork-only changes, upstream sync
  - [docs/release.md](docs/release.md): signing and versioning
  - [docs/architecture.md](docs/architecture.md): entry points, page handlers, Chrome vs Firefox

- Hard contracts
  - `master` mirrors `upstream/master`. Never commit to it.
  - `personal` is the fork. Changes that could go upstream start from `master` on their own branch, without fork-only edits mixed in, then merge into `personal`.
  - Keep the fork diff in upstream's code small. Prefer new files (like `src/content/shortcut.ts`) over edits to upstream files, so merges from upstream stay clean.
  - Never change the gecko ID `instagram-download@shbernal`. AMO ties signing and updates to it.
  - Match upstream's code style in upstream files.

- Iron Laws
  - Tokens are expensive, state of the art models need minimal guidance, don't repeat yourself, don't babysit, don't be over-specific.
  - No journaling: code comments and docs describe current state, not their edit history.
